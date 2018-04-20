/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Wang Tong
 *--------------------------------------------------------------------------------------------*/

import { TPromise } from 'vs/base/common/winjs.base';
import fs = require('fs');

export interface Distro {
	id: number;
	name: string;
	url: string;
}

export interface Package {
	id: number;
	isMetaPackage: boolean;
	name: string;
	version: string;
	distro: string;
	url: string;
	status: string;
	isInstalled: boolean;
	description: string;
	homepage: string;
	isAvailable: boolean;
}

export class PackageDb {
	private filename: string;
	private data: any;

	constructor(filename: string) {
		this.filename = filename;
		try {
			this.data = JSON.parse(fs.readFileSync(filename, 'utf8'));
		} catch (e) {
			this.data = [];
		}
	}

	private initPackage(row: any): Package {
		return {
			id: row.id,
			isMetaPackage: row.isMetaPackage,
			name: row.name,
			version: row.version,
			distro: row.distro,
			url: row.url,
			status: row.status,
			isInstalled: row.isInstalled,
			description: row.description,
			homepage: row.homepage,
			isAvailable: row.isAvailable
		};
	}

	public getMetaPackagesByLikename(partition: number, distro: string, name: string): TPromise<Array<Package>> {
		var self = this;
		var reg = new RegExp(name.replace(/\\/g, '\\\\'));
		return new TPromise<Array<Package>>((complete, fail) => {
			var result = [];
			for (var item of self.data) {
				if (reg.test(String(item.name)) && item.isMetaPackage) {
					result.push(self.initPackage(item));
				}
			}
			complete(result);
		});
	}

	public getPackagesByLikename(partition: number, distro: string, name: string): TPromise<Array<Package>> {
		var self = this;
		var reg = new RegExp(name.replace(/\\/g, '\\\\'));
		return new TPromise<Array<Package>>((complete, fail) => {
			var result = [];
			for (var item of self.data) {
				if (reg.test(String(item.name))) {
					result.push(self.initPackage(item));
				}
			}
			complete(result);
		});
	}

	public updatePackageIsInstalled(id: number, isInstalled: boolean): TPromise<void> {
		var self = this;
		return new TPromise<void>((complete, fail) => {
			for (var item of self.data) {
				if (item.id === id) {
					item.isInstalled = isInstalled;
					try {
						fs.writeFileSync(self.filename, JSON.stringify(self.data, null, 2));
					} catch (e) {
					}
					break;
				}
			}
		});
	}
}