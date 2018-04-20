import { TPromise } from 'vs/base/common/winjs.base';
import { CLIENT_ID } from 'vs/workbench/parts/community/browser/config';
import * as https from 'https';
import * as http from 'http';
import * as qs from 'querystring';
import * as url from 'url';
import GitHub = require('github-api');

export function request(options: any, body?: string): TPromise<{res: http.IncomingMessage, body: string}> {
  return new TPromise<{res: http.IncomingMessage, body: string}>((complete, fail) => {
    function response(res: http.IncomingMessage) {
      var body = '';
      var ret = res;
      console.log('options: ', options);
      console.log('response: ', res.headers);
      res.setEncoding('utf8');
      res
        .on('data', (data) => body += data)
        .on('end', () => {
          complete({res: ret, body})
        })
        .on('error', (err: Error) => fail(err));
    }
    var req: http.ClientRequest
    if (options.protocol === 'https:') {
      req = https.request(options, response);
    } else {
      req = http.request(options, response);
    }
    req.on('error', (err: Error) => fail(err));
    if (typeof body === 'string') {
      console.log(body);
      req.end(body);
    } else {
      req.end();
    }
  });
}

function makeCookies(cookies: Array<string>): string {
  if (!(cookies instanceof Array)) {
    return '';
  }
  var result = []
  for (var item of cookies) {
    var word = '';
    for (var c of item) {
      if (c === ';') {
        break
      }
      word += c
    }
    if (word !== '') {
      result.push(word);
    }
  }
  return result.join('; ');
}

export function authGithub(username: string, password: string): TPromise<string> {
  return request({
    protocol: 'https:',
    hostname: 'github.com',
    path: '/login/oauth/authorize?client_id=' + CLIENT_ID
  }).then((ret: {res: http.IncomingMessage, body: string}) => {
    var location = ret.res.headers.location;
    if (location) { 
      var opt = url.parse(location);
      return request(opt);
    } 
    throw new Error('invalid location');
  }).then((ret: {res: http.IncomingMessage, body: string}) => {
    var ex = /\<input\s+name="authenticity_token"\s+type="hidden"\s+value="(.+)"\s*/
    var it = ret.body.match(ex)
    var authenticity_token = RegExp.$1
    var body = 'commit=' + encodeURIComponent('Sign in') +
               '&login=' + encodeURIComponent(username) + 
               '&password=' + encodeURIComponent(password) + 
               '&utf8=%E2%9C%93' + 
               '&authenticity_token=' + encodeURIComponent(authenticity_token)
    return request({
      protocol: 'https:',
      hostname: 'github.com',
      path: '/session',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'Cookie': makeCookies(ret.res.headers['set-cookie'])
      }
    }, body);
  }).then((ret: {res: http.IncomingMessage, body: string}) => {
    if (ret.res.statusCode === 422) {
      throw new Error('Unprocessable Entity');
    }
    var location = ret.res.headers.location;
    if (location) { 
      var opt: any = url.parse(location);
      opt.method = 'GET';
      opt.headers = {
        'Cookie': makeCookies(ret.res.headers['set-cookie'])  
      };
      return request(opt);
    }
    throw new Error('invalid location');
  }).then((ret: {res: http.IncomingMessage, body: string}) => {
    var location = ret.res.headers.location
    if (location) {
      var opt = url.parse(location);
      return request(opt)
    }
    throw new Error('invalid location');
  }).then((ret: {res: http.IncomingMessage, body: string}) => {
    return ret.body;
  });
}
