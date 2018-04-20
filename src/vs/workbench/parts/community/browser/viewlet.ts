/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Wang Tong
 *--------------------------------------------------------------------------------------------*/

/// <reference path="./lib.d.ts" />

import 'vs/css!./media/viewlet';
import { localize } from 'vs/nls';
import { ok } from 'assert';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { TPromise } from 'vs/base/common/winjs.base';
import { Dimension, Builder, $ } from 'vs/base/browser/builder';
import * as dom from 'vs/base/browser/dom';
import { TerminalAction } from 'vs/workbench/parts/community/browser/actions';
import { VIEWLET_ID, SERVER_HOST, SERVER_PORT } from 'vs/workbench/parts/community/browser/config';
import { createExtensionCommandService } from 'vs/workbench/parts/community/browser/command';
import { CommandService } from 'vs/platform/commands/common/commandService';

import { IViewletView, Viewlet } from 'vs/workbench/browser/viewlet';
import { IMessageService, CloseAction } from 'vs/platform/message/common/message';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorGroupService } from 'vs/workbench/services/group/common/groupService';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';

import { exec } from 'child_process';
var { session } = require('electron').remote;
import * as https from 'https';
import * as http from 'http';
import { request, authGithub } from 'vs/workbench/parts/community/browser/req';
import GitHub = require('github-api');

export function laterEv(f: (e: any) => void): (e: any) => void {
  var td: any = null
  return function(e: any): void {
    clearTimeout(td);
    td = setTimeout(() => f(e), 600);
  }
}

function strigifyCookie(cookies: any) {
	var result = [];
	for (var cookie of cookies) {
		result.push(cookie.name + '=' + cookie.value);
	}
	return result.join('; ');
}

function setCookie(details: any): TPromise<void> {
	return new TPromise<void>((complete, fail) => {
		session.defaultSession.cookies.set(details, (err) => {
			err ? fail(err) : complete(null as void);
		});
	});
}

function getCookie(filter: any): TPromise<string> {
	return new TPromise<string>((complete, fail) => {
		session.defaultSession.cookies.get(filter, (err, cookies) => {
			err ? fail(err) : complete(cookies);
		});
	});
}

function removeCookie(url: string, name: string): TPromise<void> {
	return new TPromise<void>((complete, fail) => {
		session.defaultSession.cookies.remove(url, name, (err) => {
			err ? fail(err) : complete(null as void);
		});
	});
}

const loginPage =
`<div class="viewlet-community">
	<form class="viewlet-community-login">
		<input type="text" class="viewlet-community-input" />
		<input type="password" class="viewlet-community-input" />
		<button>Sign in ( GitHub ICO )</button>
	</form>
</div>`;

function renderUserPage(o: any) {
	return(
`<div class="viewlet-community">
	<div class="viewlet-community-space">
		<div class="viewlet-community-username">
			${o.githubName}
			<a class="viewlet-community-logout" href="#">logout</a>
		</div>
	</div>
</div>`);
}

export class RPMViewlet extends Viewlet {
	private root: Builder;
	private disposables: IDisposable[];
	private extensionCommand: CommandService
	private cookies: string
	private cookiesUrl: string

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService,
		@IStorageService storageService: IStorageService,
		@IEditorGroupService private editorGroupService: IEditorGroupService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IConfigurationService private configurationService: IConfigurationService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IMessageService private messageService: IMessageService
	) {
		super(VIEWLET_ID, telemetryService, themeService);
		this.disposables = [];
		this.extensionCommand = createExtensionCommandService();
		this.cookies = null;
		this.cookiesUrl = `http://${SERVER_HOST}:${SERVER_PORT}`;
	}

	public dispose(): void {
		this.disposables = dispose(this.disposables);
		super.dispose();
	}

	public create(parent: Builder): TPromise<void> {
		super.create(parent);
		this.root = parent;

		parent.on('submit', (e: Event, bd: Builder, unbind: IDisposable) => {
			var target = e.target as HTMLElement;
			if (dom.hasClass(target, 'viewlet-community-login')) {
				var form = (target as HTMLFormElement);
				e.preventDefault();
				this.onAuthToken(form);
			}
		});

		parent.on('click', (e: Event, bd: Builder, unbind: IDisposable) => {
			var target = e.target as HTMLElement;
			if (dom.hasClass(target, 'viewlet-community-profile')) {
				var button = (target as HTMLButtonElement);
				return;
			}
			if (dom.hasClass(target, 'viewlet-community-logout')) {
				var link = (target as HTMLLinkElement);
				e.preventDefault();
				this.logout();
				return;
			}
		});

		getCookie({url: this.cookiesUrl}).then((cookies: any) => {
			for (var cookie of cookies) {
				if (cookie.name === 'accessToken') {
					this.cookies = strigifyCookie(cookies);
					return this.renderUserPage();
				}
			}
			return this.reanderLoginPage();
		});

		return TPromise.as(null);
	}

	private logout() {
		removeCookie(this.cookiesUrl, 'accessToken').then(() => {
			this.cookies = null;
		  this.reanderLoginPage();
		});
	}

	private collectUserMachine() {
		var os = require('os');
		return {
			arch: os.arch(),
			cpus: os.cpus(),
			platform: os.platform(),
			release: os.release(),
			totalmem: os.totalmem(),
			type: os.type(),
			rosVersion: process.env.ROS_DISTRO
		};
	}

	private reanderLoginPage() {
		this.root.getHTMLElement().innerHTML = loginPage;
	}

	private renderUserPage(): TPromise<void> {
		console.log('renderUserPage');
		var parent = this.root;
		var message = JSON.stringify(this.collectUserMachine());
		return request({
			protocol: 'http:',
			hostname: SERVER_HOST,
			port: SERVER_PORT,
			path: '/profile',
			headers: {
				'Cookie': this.cookies,
				'Content-Length': Buffer.byteLength(message),
				'Content-Type': 'application/json'
			}
		}, message).then((ret: {res: http.IncomingMessage, body: string}) => {
			console.log(ret.res.headers);
			console.log(ret.body);
			this.root.getHTMLElement().innerHTML = renderUserPage(JSON.parse(ret.body));
		});
	}

	private onAuthToken(form: HTMLFormElement): TPromise<void> {
		var elUsername = form.querySelectorAll('.viewlet-community-input')[0] as HTMLInputElement;
		var username = elUsername.value;
		var elPassword = form.querySelectorAll('.viewlet-community-input')[1] as HTMLInputElement;
		var password = elPassword.value;
		var elButton = form.querySelector('button') as HTMLButtonElement;
		var self = this;
		var parent = this.root;

		function disable() {
			elUsername.disabled = true;
			elPassword.disabled = true;
			elButton.disabled = true;
		}

		function enable() {
			elUsername.disabled = false;
			elPassword.disabled = false;
			elButton.disabled = false;
		}

		disable();
		return authGithub(username, password)
			.then((token: string) => {
				if (typeof token === 'string' && token.length > 0) {
					console.log('token: ' + token);
					var cookie = {url: this.cookiesUrl, name: 'accessToken', value: token};
					return setCookie(cookie);
				}
				throw new Error('non auth');
			})
			.then(() => {
				return getCookie({url: this.cookiesUrl});
			})
			.then((cookies: any) => {
				self.cookies = strigifyCookie(cookies);
				return this.renderUserPage();
			});
	}

	public setVisible(visible: boolean): TPromise<void> {
		return TPromise.as(null);
	}

	public layout(dimension: Dimension): void {
		// dom.toggleClass(this.root, 'narrow', dimension.width <= 300);
	}
}


