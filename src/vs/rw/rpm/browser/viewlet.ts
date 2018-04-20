/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Wang Tong
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/viewlet';
import { localize } from 'vs/nls';
import { Registry } from 'vs/platform/platform';
import { Viewlet, ViewletRegistry, Extensions as ViewletExtensions, ViewletDescriptor } from 'vs/workbench/browser/viewlet';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { TPromise } from 'vs/base/common/winjs.base';
import { Dimension, Builder, $ } from 'vs/base/browser/builder';
import * as dom from 'vs/base/browser/dom';
import { Package, PackageDb } from 'vs/rw/rpm/browser/db';
import { TerminalAction } from 'vs/rw/rpm/browser/actions';
import { ExtensionCommandService } from 'vs/rw/rpm/browser/command';
import { CommandService } from 'vs/platform/commands/common/commandService';
import { IMessageService } from 'vs/platform/message/common/message';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorGroupService } from 'vs/workbench/services/group/common/groupService';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { ScrollableElementResolvedOptions } from 'vs/base/browser/ui/scrollbar/scrollableElementOptions';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import electron = require('electron');
import cp = require('child_process');
import path = require('path');
import * as logging from 'vs/rw/logging';
import conf from 'vs/rw/config';

export function laterEv(f: (e: any) => void): (e: any) => void {
	var td: any = null;
	return function (e: any): void {
		clearTimeout(td);
		td = setTimeout(() => f(e), 600);
	};
}

function escape(str) {
	return str.replace(/\</g, '&lt');
}

function renderPackageList(pkgs: Array<Package>) {
	var items = [];
	for (var pkg of pkgs) {
		var item =
			// <img src="http://nodejs.cn/static/images/logo.svg" width="40px" height="40px" alt="img" />
			`<li class="viewlet-rpm-item" data-homepage="${pkg.homepage}" data-name="${pkg.name}" data-id="${pkg.id}">
			<div class="viewlet-rpm-content">
				<h3>${escape(pkg.name)}</h3>
				<p>${escape(pkg.description)}</p>
				<div class="viewlet-rpm-menu">
					<button class="viewlet-rpm-install install" data-pkgname="${pkg.name}">INSTALL</button>
					<span class="viewlet-rpm-desc">${escape(pkg.version)}</span>
					<span class="viewlet-rpm-desc">${escape(pkg.status)}</span>
				</div>
			</div>
		</li>`;
		items.push(item);
	}
	return `<ul class="viewlet-rpm-list">${items.join('')}</ul>`;
}

export class RPMViewlet extends Viewlet {
	private static MODULE_ID = 'vs/rw/rpm/browser/viewlet';
	private static CONSTRUTOR = 'RPMViewlet';
	private static ID = 'roboware.rpm.viewlet';
	private static LABEL = localize('rpm', "ROS Packages Manager");
	private static CSS_CLASS = 'rpm';
	private static ORDER = 50;

	public static registry() {
		Registry
			.as<ViewletRegistry>(ViewletExtensions.Viewlets)
			.registerViewlet(
				new ViewletDescriptor(
					RPMViewlet.MODULE_ID,
					RPMViewlet.CONSTRUTOR,
					RPMViewlet.ID,
					RPMViewlet.LABEL,
					RPMViewlet.CSS_CLASS,
					RPMViewlet.ORDER));
	}

	private db: PackageDb;
	private root: Builder;
	private disposables: IDisposable[];
	private partition: number;
	private terminalAction: TerminalAction;
	private extensionCommand: CommandService;
	private working: boolean;
	private timer: any;
	private syncLock: boolean;
	private pkgs: Array<Package>;
	private currPkgname: string;
	private meta: boolean;
	private scrollableElement: ScrollableElement;

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
		super(RPMViewlet.ID, telemetryService, themeService);
		this.db = new PackageDb(path.join(conf.rpm.home, conf.rosDistro + '.json'));
		this.disposables = [];
		this.partition = 1;
		this.terminalAction = TerminalAction.createInstance(instantiationService);
		this.extensionCommand = ExtensionCommandService.createInstance();
		this.working = false;
		this.timer = null;
		this.syncLock = false;
		this.pkgs = null;
		this.currPkgname = '';
		this.meta = true;
	}

	public dispose(): void {
		this.disposables = dispose(this.disposables);
		super.dispose();
	}

	public create(parent: Builder): TPromise<void> {
		super.create(parent);
		this.root = parent;
		var children = $(
			`<div class="viewlet-rpm">
				<div class="viewlet-rpm-box">
					<div class="viewlet-rpm-header">
						<select class="viewlet-rpm-select monaco-workbench">
							<option value="meta">metapackages</option>
							<option value="all">packages</option>
						</select>

						<div class="viewlet-rpm-input-wrapper">
							<input type="text" class="viewlet-rpm-input" />
						</div>
					</div>

					<ul class="viewlet-rpm-list">
					</ul>
				</div>
			</div>`);

		this.scrollableElement = new ScrollableElement(children.getHTMLElement(), {
			canUseTranslate3d: true,
			alwaysConsumeMouseWheel: true,
			horizontal: ScrollbarVisibility.Hidden,
			vertical: ScrollbarVisibility.Auto,
			useShadows: true
		} as ScrollableElementResolvedOptions);

		this.scrollableElement.onScroll((e) => {
			var scrollTop = e.scrollTop;
			var box = (document.querySelector('.viewlet-rpm .viewlet-rpm-box')) as HTMLElement;
			box.style.top = -scrollTop + 'px';
		});

		parent.addClass('viewlet-rpm-wrapper');
		parent.append(this.scrollableElement.getDomNode());

		parent.on('click', (e: Event, bd: Builder, unbind: IDisposable) => {
			var target = e.target as HTMLElement;
			if (dom.hasClass(target, 'viewlet-rpm-install')) {
				this.onInstall(target as HTMLButtonElement);
				return;
			}
			var li = dom.findParentWithClass(target, 'viewlet-rpm-item');
			if (li) {
				this.onHomepage(li as HTMLLIElement);
				return;
			}
		});

		var onInput = laterEv(this.onInput.bind(this));
		parent.on('input', (e: Event, bd: Builder, unbind: IDisposable) => {
			var target = e.target as HTMLElement;
			if (dom.hasClass(target, 'viewlet-rpm-input')) {
				onInput(target as HTMLInputElement);
			}
		});

		parent.on('change', (e: Event, bd: Builder, unbind: IDisposable) => {
			var target = e.target as HTMLElement;
			if (dom.hasClass(target, 'viewlet-rpm-select')) {
				this.onChange(target as HTMLSelectElement);
			}
		});

		return this.renderPackageList();
	}

	private sync(time: number) {
		if (this.working && !this.syncLock) {
			clearTimeout(this.timer);
			this.syncLock = true;
			this.timer = setTimeout(() => {
				cp.exec(`rospack list-names`, (err, stdout: string, stderr: string) => {
					cp.exec(`rosstack list-names`, (err2, stdout2: string, stderr2: string) => {
						this.syncLock = false;
						if (!err && this.working && !err2) {
							var names = stdout.split('\n');
							var names2 = stdout2.split('\n');
							var items = document.querySelectorAll('.viewlet-rpm-item');
							for (var i = 0, len = items.length; i < len; i++) {
								var item = $(items[i] as HTMLElement);
								var name = item.attr('data-name');
								var btn = items[i].querySelector('.viewlet-rpm-install');
								li: {
									for (var j = 0, l = names.length; j < l; j++) {
										if (name === names[j]) {
											btn.innerHTML = 'UNINSTALL';
											dom.removeClass(btn as HTMLElement, 'install');
											dom.addClass(btn as HTMLElement, 'uninstall');
											break li;
										}
									}
									for (var j = 0, l = names2.length; j < l; j++) {
										if (name === names2[j]) {
											btn.innerHTML = 'UNINSTALL';
											dom.removeClass(btn as HTMLElement, 'install');
											dom.addClass(btn as HTMLElement, 'uninstall');
											break li;
										}
									}
									btn.innerHTML = 'INSTALL';
									dom.removeClass(btn as HTMLElement, 'uninstall');
									dom.addClass(btn as HTMLElement, 'install');
								}
							}
							for (var i = 0, len = this.pkgs.length; i < len; i++) {
								li: {
									for (var j = 0, length = names.length; j < length; j++) {
										if (this.pkgs[i].name === names[j]) {
											this.pkgs[i].isInstalled = true;
											break li;
										}
									}
									for (var j = 0, length = names2.length; j < length; j++) {
										if (this.pkgs[i].name === names2[j]) {
											this.pkgs[i].isInstalled = true;
											break li;
										}
									}
									this.pkgs[i].isInstalled = false;
								}
							}
						}
						this.sync(1 * 1000);
					});
				});
			}, time);
		}
	}

	private onChange(select: HTMLSelectElement) {
		this.meta = select.value === 'meta';
		this.renderPackageList(this.currPkgname);
	}

	private onInstall(button: HTMLButtonElement) {
		var pkgname = button.getAttribute('data-pkgname');
		var install = dom.hasClass(button, 'install') ? 'install' : 'remove';
		this.terminalAction
			.run(`sudo apt-get ${install} ros-${conf.rosDistro}-${pkgname.replace(/\_/g, '-')}`)
			.then((args) => {
				electron.ipcRenderer.send('count-rpm-package', JSON.stringify({
					distro: conf.rosDistro,
					name: pkgname,
					date: new Date(),
					action: install
				}));
			}, (err) => {
				logging.error(err.message);
			});
	}

	private onInput(input: HTMLInputElement) {
		this.currPkgname = input.value;
		this.renderPackageList(input.value);
	}

	private onHomepage(li: HTMLLIElement) {
		var items = this.root.select('.viewlet-rpm-item');
		for (var i = 0, len = items.length; i < len; i++) {
			items.item(i).removeClass('gray');
		}
		$(li).addClass('gray');
		this.extensionCommand
			.executeCommand('extension.view.rpmweb', $(li).attr('data-homepage'))
			.then((args) => {
				//console.log('extension command .')
			}, (err) => {
				logging.error(err.message);
			});
	}

	private renderPackageList(pkgname = ''): TPromise<void> {
		var parent = this.root;
		if (this.pkgs === null) {
			return this.db
				.getPackagesByLikename(this.partition, conf.rosDistro, pkgname)
				.then((pkgs: Array<Package>) => {
					this.working = true;
					this.pkgs = pkgs;
					if (this.meta) {
						parent.select('.viewlet-rpm-list').innerHtml(renderPackageList(this.pkgs.filter((pkg) => {
							return pkg.isMetaPackage;
						})));
					} else {
						parent.select('.viewlet-rpm-list').innerHtml(renderPackageList(this.pkgs));
					}
				}, (err) => logging.error(err.message));
		} else {
			if (this.meta) {
				parent.select('.viewlet-rpm-list').innerHtml(renderPackageList(this.pkgs.filter((pkg) => {
					return pkg.isMetaPackage && pkg.name.search(pkgname) > -1;
				})));
			} else {
				parent.select('.viewlet-rpm-list').innerHtml(renderPackageList(this.pkgs.filter((pkg) => {
					return pkg.name.search(pkgname) > -1;
				})));
			}
			return TPromise.as(null);
		}
	}

	public setVisible(visible: boolean): TPromise<void> {
		if (!visible) {
			this.working = false;
		}
		this.sync(0);
		return TPromise.as(null);
	}

	public layout(dimension: Dimension): void {
		this.scrollableElement.updateState({
			height: dom.getContentHeight(this.root.getHTMLElement()),//dimension.height || dom.getContentHeight(this._domNode)
			scrollHeight: document.querySelector('.viewlet-rpm .viewlet-rpm-box').scrollHeight
		});
	}
}
