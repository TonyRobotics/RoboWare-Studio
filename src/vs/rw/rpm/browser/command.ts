/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Wang Tong
 *--------------------------------------------------------------------------------------------*/

import { TPromise } from 'vs/base/common/winjs.base';
import { CommandService } from 'vs/platform/commands/common/commandService';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { IExtensionService, ExtensionPointContribution, IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { IExtensionPoint } from 'vs/platform/extensions/common/extensionsRegistry';

class RPMExtensionService implements IExtensionService {
	_serviceBrand: any;
	activateByEvent(activationEvent: string): TPromise<void> {
		return this.onReady().then(() => { });
	}
	onReady(): TPromise<boolean> {
		return TPromise.as(true);
	}
	readExtensionPointContributions<T>(extPoint: IExtensionPoint<T>): TPromise<ExtensionPointContribution<T>[]> {
		return TPromise.as([]);
	}
	getExtensionsStatus() {
		return undefined;
	}
	getExtensions(): TPromise<IExtensionDescription[]> {
		return TPromise.wrap([]);
	}
}

export class ExtensionCommandService {
	public static createInstance(): CommandService {
		return new CommandService(new InstantiationService(), new RPMExtensionService());
	}
}