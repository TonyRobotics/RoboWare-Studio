/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Wang Tong
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as os from 'os';
import conf from './config';

enum Level {
	all, debug, info, notice, warn, error, fatal, none
}

function getLevel(level: Level): string {
	switch (level) {
		case 0: return 'all';
		case 1: return 'debug';
		case 2: return 'info';
		case 3: return 'notice';
		case 4: return 'warn';
		case 5: return 'error';
		case 6: return 'fatal';
		default: return 'none';
	}
}

function fill(val) {
	return val < 10 ? '0' + val : val.toString();
}

class FileLogger {
	private static MAX_LEN = 100 * 1024 * 1024;

	constructor(
		private filename: string,
		private levelThreshold: Level = Level.all
	) {
	}

	public log(level: Level, message: string) {
		// TODO: opmitize
		if (level >= this.levelThreshold) {
			var date = new Date();
			var message =
				`${fill(date.getFullYear())}-${fill(date.getMonth() + 1)}-${fill(date.getDate())} ` +
				`${fill(date.getHours())}:${fill(date.getMinutes())}:${fill(date.getSeconds())} ` +
				`[${getLevel(level)}] ` + message + os.EOL;

			try {
				var stat = fs.statSync(this.filename);
				if (stat.size < FileLogger.MAX_LEN) {
					fs.appendFileSync(this.filename, message);
				}
			} catch (e) {
				fs.writeFileSync(this.filename, message);
			}
		}
	}
}

var gFileLogger: FileLogger = null;
function getGFileLogger(): FileLogger {
	if (gFileLogger === null) {
		gFileLogger = new FileLogger(conf.logfile);
	}
	return gFileLogger;
}

export function all(message: string) {
	getGFileLogger().log(Level.all, message);
}

export function debug(message: string) {
	getGFileLogger().log(Level.debug, message);
}

export function info(message: string) {
	getGFileLogger().log(Level.info, message);
}

export function notice(message: string) {
	getGFileLogger().log(Level.notice, message);
}

export function warn(message: string) {
	getGFileLogger().log(Level.warn, message);
}

export function error(message: string) {
	getGFileLogger().log(Level.error, message);
}

export function fatal(message: string) {
	getGFileLogger().log(Level.fatal, message);
}

export function none(message: string) {
	getGFileLogger().log(Level.none, message);
}

