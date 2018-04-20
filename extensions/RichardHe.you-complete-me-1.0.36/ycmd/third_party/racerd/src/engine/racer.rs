//! SemanticEngine implementation for [the racer library](https://github.com/phildawes/racer)
//!
use engine::{SemanticEngine, Definition, Context, CursorPosition, Completion};

use racer::core::{Session, FileCache};
use racer::scopes::{coords_to_point, point_to_coords};

use std::path::Path;

use std::sync::Mutex;

pub struct Racer<'a> {
    cache: Mutex<&'a FileCache<'a>>
}

impl<'a> Racer<'a> {
    pub fn new() -> Racer<'a> {
        // The unsafe block in the constructor is taking ownership of the Session allocated by this
        // box. It is later freed in the drop impl. Having a Session reference with the same
        // lifetime as Racer solves a concrete self lifetime problem in the SemanticEngine
        // implementation.
        //
        // The following unsafe block should be fine since the memory is known to be valid. The
        // reference will have the same value for the lifetime of the Racer object, so there is no
        // need to worry about stale references wandering around. However, I am not certain that
        // MutexGuard will save us from references escaping a critical section since you normally
        // cannot store references in a Mutex. At this time, that's not a problem, but it would be
        // good to have a static guarantee about not leaking references.
        let cache = Box::new(FileCache::new());
        let cache_ptr = Box::into_raw(cache);
        Racer {
            cache: Mutex::new(unsafe { &*cache_ptr })
        }
    }

    pub fn build_racer_args<'b, 'c>(&self, ctx: &'b Context, session: &'c Session<'a>)
        -> (&'a str, usize, &'b Path) {

        let path = ctx.query_path();

        for buffer in &ctx.buffers {
            session.cache_file_contents(buffer.path(), &buffer.contents[..]);
        }

        let query_src = &session.load_file(path).src.code[..];
        let pos = coords_to_point(query_src, ctx.query_cursor.line, ctx.query_cursor.col);

        (query_src, pos, path)
    }
}

impl<'a> Drop for Racer<'a> {
    fn drop(&mut self) {
        let cache_ref = *self.cache.lock().unwrap();
        // At this point, nobody has a reference to the session because it is locked behind the
        // mutex and the lock is held here. Nobody has a reference to the mutex because its holder
        // is being dropped. Thus, casting a non mutable reference to a raw *mut pointer to
        // reconstitute the box should be fine.
        let _cache: Box<FileCache> = unsafe { Box::from_raw(::std::mem::transmute(cache_ref)) };
    }
}

use ::Config;
use super::Result;

impl<'a> SemanticEngine for Racer<'a> {
    fn initialize(&self, config: &Config) -> Result<()> {
        if let Some(ref src_path) = config.rust_src_path {
            ::std::env::set_var("RUST_SRC_PATH", &src_path[..]);
        }

        Ok(())
    }

    fn find_definition(&self, ctx: &Context) -> Result<Option<Definition>> {
        let cache = match self.cache.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner()
        };
        let session = Session::from_path(&cache, ctx.query_path(), ctx.query_path());
        let (query_src, pos, path) = self.build_racer_args(ctx, &session);

        // TODO catch_panic: apparently this can panic! in a string operation. Something about pos
        // not landing on a character boundary.
        Ok(match ::racer::core::find_definition(query_src, path, pos, &session) {
            Some(m) => {
                // TODO modify racer Match to return line, col. For now, read the file it found a
                // match in to translate the Match position into line, col.
                let (line, col) = {
                    let found_src = &session.load_file(m.filepath.as_path());
                    let found_src_str = &found_src.src.code[..];
                    // TODO This can panic if the position is out of bounds :(
                    point_to_coords(found_src_str, m.point)
                };

                let match_type = format!("{:?}", m.mtype);
                Some(Definition {
                    position: CursorPosition {
                        line: line,
                        col: col
                    },
                    dtype: match_type,
                    file_path: m.filepath.to_str().unwrap().to_string(),
                    text: m.matchstr.clone(),
                    text_context: m.contextstr.clone(),
                })
            },
            None => None
        })
    }

    fn list_completions(&self, ctx: &Context) -> Result<Option<Vec<Completion>>> {
        let cache = match self.cache.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner()
        };
        let session = Session::from_path(&cache, ctx.query_path(), ctx.query_path());
        let (query_src, pos, path) = self.build_racer_args(ctx, &session);

        let matches = ::racer::core::complete_from_file(query_src, path, pos, &session);

        let completions = matches.map(|m| {
            let (line, col) = {
                let found_src = &session.load_file(m.filepath.as_path());
                let found_src_str = &found_src.src.code[..];
                // TODO This can panic if the position is out of bounds :(
                point_to_coords(found_src_str, m.point)
            };

            Completion {
                position: CursorPosition {
                    line: line,
                    col: col
                },
                text: m.matchstr,
                context: m.contextstr,
                kind: format!("{:?}", m.mtype),
                file_path: m.filepath.to_str().unwrap().to_string()
            }
        }).collect::<Vec<_>>();

        if completions.len() != 0 {
            Ok(Some(completions))
        } else {
            Ok(None)
        }
    }
}

unsafe impl<'a> Sync for Racer<'a> {}
unsafe impl<'a> Send for Racer<'a> {}

#[cfg(test)]
mod tests {
    use super::*;
    use engine::{Context, CursorPosition, SemanticEngine, Buffer};

    use ::util::fs::TmpFile;

    #[test]
    #[allow(unused_variables)]
    fn find_definition() {
        // FIXME this is just here for side effects.
        let src2 = TmpFile::with_name("src2.rs", "
            pub fn myfn() {}
            pub fn foo() {}
            ");

        let src = "
            use src2::*;
            mod src2;
            fn main() {
                myfn();
            }";

        let buffers = vec![Buffer {
            contents: src.to_string(),
            file_path: "src.rs".to_string()
        }];

        let ctx = Context::new(buffers, CursorPosition { line: 5, col: 17 }, "src.rs");
        let racer = Racer::new();
        let def = racer.find_definition(&ctx).unwrap().unwrap();

        assert_eq!(def.text, "myfn");
    }

    #[test]
    #[allow(unused_variables)]
    fn find_completion() {
        let src = "
            mod mymod {
                /// myfn is a thing
                pub fn myfn<T>(reader: T) where T: ::std::io::Read {}
            }

            fn main() {
                mymod::my
            }";

        let buffers = vec![Buffer {
            contents: src.to_string(),
            file_path: "src.rs".to_string()
        }];

        let ctx = Context::new(buffers, CursorPosition { line: 8, col: 25 }, "src.rs");
        let racer = Racer::new();

        let completions = racer.list_completions(&ctx).unwrap().unwrap();
        assert_eq!(completions.len(), 1);

        let completion = &completions[0];
        assert_eq!(completion.text, "myfn");
        assert_eq!(completion.position.line, 4);
        assert_eq!(completion.file_path, "src.rs");
    }
}
