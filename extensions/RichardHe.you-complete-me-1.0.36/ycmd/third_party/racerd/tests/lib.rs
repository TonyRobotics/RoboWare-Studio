#![deny(warnings)]

extern crate libracerd;
extern crate rustc_serialize;

#[macro_use]
extern crate hyper;

extern crate crypto;

mod util;

/// Although the value is not used, running env! for RUST_SRC_PATH checks, before running the tests,
/// that the required environment variable is defined.
const _RUST_SRC_PATH: &'static str = env!("RUST_SRC_PATH");

#[test]
#[should_panic]
#[cfg(not(windows))]
fn panics_when_invalid_secret_given() {
    use ::libracerd::engine::{Racer, SemanticEngine};
    use ::libracerd::http::serve;
    use ::libracerd::Config;

    let config = Config {
        secret_file: Some("a.file.that.does.not.exist".to_owned()),
        print_http_logs: true,
        .. Default::default()
    };

    let engine = Racer::new();
    engine.initialize(&config).unwrap();
    serve(&config, engine).unwrap();
}

mod http {
    use hyper::header::ContentType;
    use hyper::Client;

    use std::io::Read;

    header! { (XRacerdHmac, "x-racerd-hmac") => [String] }

    use util::http::{self, UrlBuilder, request_str};

    use rustc_serialize::json::{Json};
    use libracerd::util::fs::TmpFile;

    use hyper::method::Method;

    /// Checks that /find_definition works within a single buffer
    #[test]
    fn find_definition() {
        http::with_server(|server| {
            // Build request args
            let url = server.url("/find_definition");
            let request_obj = stringify!({
                "buffers": [{
                    "file_path": "src.rs",
                    "contents": "fn foo() {}\nfn bar() {}\nfn main() {\nfoo();\n}"
                }],
                "file_path": "src.rs",
                "line": 4,
                "column": 3
            });

            // Make request
            let res = request_str(Method::Post, &url[..], Some(request_obj)).unwrap().unwrap();

            // Build actual/expected objects
            let actual = Json::from_str(&res[..]).unwrap();
            let expected = Json::from_str(stringify!({
                "text": "foo",
                "line": 1,
                "column": 3,
                "file_path": "src.rs"
            })).unwrap();

            // They should be equal
            assert_eq!(actual, expected);
        });
    }

    /// Checks that /find_definition correctly resolves cross file definitions when the buffers have
    /// not been written to disk.
    #[test]
    fn find_definition_multiple_dirty_buffers() {
        // Build request args
        let request_obj = stringify!({
            "buffers": [{
                "file_path": "src.rs",
                "contents": "mod src2;\nuse src2::{foo,myfn};\nfn main() {\n    myfn();\n}\n"
            }, {
                "file_path": "src2.rs",
                "contents": "\npub fn myfn()\npub fn foo() {}\n"
            }],
            "file_path": "src.rs",
            "line": 4,
            "column": 7
        });

        // Create an *empty* temporary file. The request contains unsaved file contents. For rust
        // module inclusions to work, the compiler checks certain locations on the file system where
        // a module file could be located. It simply doesn't work with unnamed files.
        let _f = TmpFile::with_name("src2.rs", "");

        http::with_server(|server| {
            // Make request
            let url = server.url("/find_definition");
            let res = request_str(Method::Post, &url[..], Some(request_obj)).unwrap().unwrap();

            // Build actual/expected objects
            let actual = Json::from_str(&res[..]).unwrap();
            let expected = Json::from_str(stringify!({
                "text": "myfn",
                "line": 2,
                "column": 7,
                "file_path": "src2.rs"
            })).unwrap();

            // They should be equal
            assert_eq!(actual, expected);
        });
    }

    macro_rules! assert_str_prop_on_obj_in_list {
        ($prop:expr, $val:expr, $list:expr) => {
            assert!($list.as_array().unwrap().iter().any(|c| {
                $val == c.as_object().unwrap().get($prop).unwrap().as_string().unwrap()
            }));
        }
    }

    #[test]
    fn find_definition_in_std_library() {
        // Build request args
        let request_obj = stringify!({
            "buffers": [{
                "file_path": "src.rs",
                "contents": "use std::path::Path;\nfn main() {\nlet p = &Path::new(\"arst\")\n}\n"
            }],
            "file_path": "src.rs",
            "line": 3,
            "column": 16
        });

        http::with_server(|server| {
            // Make request
            let url = server.url("/find_definition");
            let res = request_str(Method::Post, &url[..], Some(request_obj)).unwrap().unwrap();

            // Build actual/expected objects
            let actual = Json::from_str(&res[..]).unwrap();

            // We don't know exactly how the result is going to look in this case.
            let obj = actual.as_object().unwrap();

            // Check that `file_path` ends_with "path.rs"
            let found_path = obj.get("file_path").unwrap().as_string().unwrap();
            assert!(found_path.ends_with("path.rs"));

            // Check that we found a thing called "new"
            let found_text = obj.get("text").unwrap().as_string().unwrap();
            assert_eq!(found_text, "new");
        });
    }

    #[test]
    fn list_path_completions_std_library() {
        use rustc_serialize::json;

        // Build request args
        let request_obj = stringify!({
            "buffers": [{
                "file_path": "src.rs",
                "contents": "use std::path;\nfn main() {\nlet p = &path::\n}\n"
            }],
            "file_path": "src.rs",
            "line": 3,
            "column": 15
        });

        http::with_server(|server| {
            // Make request
            let url = server.url("/list_completions");
            let res = request_str(Method::Post, &url[..], Some(request_obj)).unwrap().unwrap();

            let list = Json::from_str(&res[..]).unwrap();

            println!("{}", json::as_pretty_json(&list));

            // Check that the "Path" completion is available
            assert_str_prop_on_obj_in_list!("text", "Path", list);
            assert_str_prop_on_obj_in_list!("text", "PathBuf", list);
        });
    }

    #[test]
    fn ping_pong() {
        http::with_server(|server| {
            let url = server.url("/ping");
            let res = request_str(Method::Get, &url[..], None).unwrap().unwrap();
            let actual = Json::from_str(&res[..]).unwrap();

            let expected = Json::from_str(stringify!({
                "pong": true
            })).unwrap();

            assert_eq!(actual, expected);
        });
    }

    #[test]
    fn ping_pong_hmac_with_correct_secret() {
        let secret = "hello hmac ping pong";

        http::with_hmac_server(secret, |server| {
            // The request hmac in this case should be
            let hmac = ::util::request_hmac(secret, "GET", "/ping", "");

            let url = server.url("/ping");

            let client = Client::new();
            let mut res = client.get(&url[..])
                                .header(XRacerdHmac(hmac))
                                .header(ContentType::json())
                                .send().unwrap();

            assert_eq!(res.status, ::hyper::status::StatusCode::Ok);

            let mut body = String::new();
            res.read_to_string(&mut body).unwrap();

            let actual = Json::from_str(&body[..]).unwrap();
            let expected = Json::from_str(stringify!({
                "pong": true
            })).unwrap();

            assert_eq!(actual, expected);
        });
    }

    #[test]
    fn ping_pong_hmac_wrong_secret() {
        let secret = "hello hmac ping pong";

        http::with_hmac_server(secret, |server| {
            // The request hmac in this case should be
            let hmac = ::util::request_hmac("different secret", "GET", "/ping", "");

            let url = server.url("/ping");

            let client = Client::new();
            let res = client.get(&url[..])
                            .header(XRacerdHmac(hmac))
                            .header(ContentType::json())
                            .send().unwrap();

            assert_eq!(res.status, ::hyper::status::StatusCode::Forbidden);
        });
    }
}
