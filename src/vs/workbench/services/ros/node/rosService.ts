/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Jinan Tony Robotics Co., Ltd. All rights reserved.
 *  Author: Sun Liang
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { join } from 'path';
import { exec } from 'child_process';

import encoding = require('vs/base/node/encoding');
import * as fs from 'fs';
import pfs = require('vs/base/node/pfs');
import nls = require('vs/nls');
import { TPromise } from 'vs/base/common/winjs.base';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IRosService, TaskName } from 'vs/platform/ros/common/ros';
import { templates as taskTemplates } from 'vs/workbench/parts/tasks/common/taskTemplates';

export const rosLaunchJson: string = [
	'{',
	'\t"version": "0.2.0",',
	'\t"configurations": [',
	'\t\t{',
	'\t\t\t"name": "C++",',
	'\t\t\t"type": "gdb",',
	'\t\t\t"request": "launch",',
	'\t\t\t"target": "${file}",',
	'\t\t\t"cwd": "${workspaceRoot}"',
	'\t\t},',
	'\t\t{',
	'\t\t\t"name": "C++ (remote)",',
	'\t\t\t"type": "gdb",',
	'\t\t\t"request": "launch",',
	'\t\t\t"target": "dev${relativeFile}",',
	'\t\t\t"cwd": "${workspaceRoot}",',
	'\t\t\t"ssh": {',
	'\t\t\t\t"host": "remotehost",',
	'\t\t\t\t"user": "remoteuser",',
	'\t\t\t\t"keyfile": "/home/user/.ssh/id_rsa",',
	'\t\t\t\t"cwd": "/home/remote/ws"',
	'\t\t\t}',
	'\t\t},',
	'\t\t{',
	'\t\t\t"name": "Python",',
	'\t\t\t"type": "python",',
	'\t\t\t"request": "launch",',
	'\t\t\t"stopOnEntry": true,',
	'\t\t\t"pythonPath": "${config:python.pythonPath}",',
	'\t\t\t"program": "${file}",',
	'\t\t\t"debugOptions": [',
	'\t\t\t\t"WaitOnAbnormalExit",',
	'\t\t\t\t"WaitOnNormalExit",',
	'\t\t\t\t"RedirectOutput"',
	'\t\t\t]',
	'\t\t}',
	'\t]',
	'}'
].join('\n');

export const rosTemplateCppPubNode: string = [
	'#include "ros/ros.h"',
	'#include "std_msgs/String.h"',
	'',
	'#include <sstream>',
	'',
	'/**',
	' * This tutorial demonstrates simple sending of messages over the ROS system.',
	' */',
	'int main(int argc, char *argv[])',
	'{',
	'\t/**',
	'\t * The ros::init() function needs to see argc and argv so that it can perform',
	'\t * any ROS arguments and name remapping that were provided at the command line.',
	'\t * For programmatic remappings you can use a different version of init() which takes',
	'\t * remappings directly, but for most command-line programs, passing argc and argv is',
	'\t * the easiest way to do it.  The third argument to init() is the name of the node.',
	'\t *',
	'\t * You must call one of the versions of ros::init() before using any other',
	'\t * part of the ROS system.',
	'\t */',
	'\tros::init(argc, argv, "${node_name}");',
	'',
	'\t/**',
	'\t * NodeHandle is the main access point to communications with the ROS system.',
	'\t * The first NodeHandle constructed will fully initialize this node, and the last',
	'\t * NodeHandle destructed will close down the node.',
	'\t */',
	'\tros::NodeHandle n;',
	'',
	'\t/**',
	'\t * The advertise() function is how you tell ROS that you want to',
	'\t * publish on a given topic name. This invokes a call to the ROS',
	'\t * master node, which keeps a registry of who is publishing and who',
	'\t * is subscribing. After this advertise() call is made, the master',
	'\t * node will notify anyone who is trying to subscribe to this topic name,',
	'\t * and they will in turn negotiate a peer-to-peer connection with this',
	'\t * node.  advertise() returns a Publisher object which allows you to',
	'\t * publish messages on that topic through a call to publish().  Once',
	'\t * all copies of the returned Publisher object are destroyed, the topic',
	'\t * will be automatically unadvertised.',
	'\t *',
	'\t * The second parameter to advertise() is the size of the message queue',
	'\t * used for publishing messages.  If messages are published more quickly',
	'\t * than we can send them, the number here specifies how many messages to',
	'\t * buffer up before throwing some away.',
	'\t */',
	'\tros::Publisher chatter_pub = n.advertise<std_msgs::String>("chatter", 1000);',
	'',
	'\tros::Rate loop_rate(10);',
	'',
	'\t/**',
	'\t * A count of how many messages we have sent. This is used to create',
	'\t * a unique string for each message.',
	'\t */',
	'\tint count = 0;',
	'\twhile (ros::ok())',
	'\t{',
	'\t\t/**',
	'\t\t * This is a message object. You stuff it with data, and then publish it.',
	'\t\t */',
	'\t\tstd_msgs::String msg;',
	'',
	'\t\tstd::stringstream ss;',
	'\t\tss << "hello world " << count;',
	'\t\tmsg.data = ss.str();',
	'',
	'\t\tROS_INFO("%s", msg.data.c_str());',
	'',
	'\t\t/**',
	'\t\t * The publish() function is how you send messages. The parameter',
	'\t\t * is the message object. The type of this object must agree with the type',
	'\t\t * given as a template parameter to the advertise<>() call, as was done',
	'\t\t * in the constructor above.',
	'\t\t */',
	'\t\tchatter_pub.publish(msg);',
	'',
	'\t\tros::spinOnce();',
	'',
	'\t\tloop_rate.sleep();',
	'\t\t++count;',
	'\t}',
	'',
	'\treturn 0;',
	'}'
].join('\n');

export const rosTemplateCppSubNode: string = [
	'#include "ros/ros.h"',
	'#include "std_msgs/String.h"',
	'',
	'/**',
	' * This tutorial demonstrates simple receipt of messages over the ROS system.',
	' */',
	'void chatterCallback(const std_msgs::String::ConstPtr& msg)',
	'{',
	'\tROS_INFO("I heard: [%s]", msg->data.c_str());',
	'}',
	'',
	'int main(int argc, char *argv[])',
	'{',
	'\t/**',
	'\t * The ros::init() function needs to see argc and argv so that it can perform',
	'\t * any ROS arguments and name remapping that were provided at the command line.',
	'\t * For programmatic remappings you can use a different version of init() which takes',
	'\t * remappings directly, but for most command-line programs, passing argc and argv is',
	'\t * the easiest way to do it.  The third argument to init() is the name of the node.',
	'\t *',
	'\t * You must call one of the versions of ros::init() before using any other',
	'\t * part of the ROS system.',
	'\t */',
	'\tros::init(argc, argv, "${node_name}");',
	'',
	'\t/**',
	'\t * NodeHandle is the main access point to communications with the ROS system.',
	'\t * The first NodeHandle constructed will fully initialize this node, and the last',
	'\t * NodeHandle destructed will close down the node.',
	'\t */',
	'\tros::NodeHandle n;',
	'',
	'\t/**',
	'\t * The subscribe() call is how you tell ROS that you want to receive messages',
	'\t * on a given topic.  This invokes a call to the ROS',
	'\t * master node, which keeps a registry of who is publishing and who',
	'\t * is subscribing.  Messages are passed to a callback function, here',
	'\t * called chatterCallback.  subscribe() returns a Subscriber object that you',
	'\t * must hold on to until you want to unsubscribe.  When all copies of the Subscriber',
	'\t * object go out of scope, this callback will automatically be unsubscribed from',
	'\t * this topic.',
	'\t *',
	'\t * The second parameter to the subscribe() function is the size of the message',
	'\t * queue.  If messages are arriving faster than they are being processed, this',
	'\t * is the number of messages that will be buffered up before beginning to throw',
	'\t * away the oldest ones.',
	'\t */',
	'\tros::Subscriber sub = n.subscribe("chatter", 1000, chatterCallback);',
	'',
	'\t/**',
	'\t * ros::spin() will enter a loop, pumping callbacks.  With this version, all',
	'\t * callbacks will be called from within this thread (the main one).  ros::spin()',
	'\t * will exit when Ctrl-C is pressed, or the node is shutdown by the master.',
	'\t */',
	'\tros::spin();',
	'',
	'\treturn 0;',
	'}'
].join('\n');

export const rosTemplatePythonPubNode: string = [
	'#!/usr/bin/env python',
	'\'\'\'${node_name} ROS Node\'\'\'',
	'# license removed for brevity',
	'import rospy',
	'from std_msgs.msg import String',
	'',
	'def talker():',
	'    \'\'\'${node_name} Publisher\'\'\'',
	'    pub = rospy.Publisher(\'chatter\', String, queue_size=10)',
	'    rospy.init_node(\'${node_name}\', anonymous=True)',
	'    rate = rospy.Rate(10) # 10hz',
	'    while not rospy.is_shutdown():',
	'        hello_str = "hello world %s" % rospy.get_time()',
	'        rospy.loginfo(hello_str)',
	'        pub.publish(hello_str)',
	'        rate.sleep()',
	'',
	'if __name__ == \'__main__\':',
	'    try:',
	'        talker()',
	'    except rospy.ROSInterruptException:',
	'        pass',
	''
].join('\n');

export const rosTemplatePythonSubNode: string = [
	'#!/usr/bin/env python',
	'\'\'\'${node_name} ROS Node\'\'\'',
	'import rospy',
	'from std_msgs.msg import String',
	'',
	'def callback(data):',
	'    \'\'\'${node_name} Callback Function\'\'\'',
	'    rospy.loginfo(rospy.get_caller_id() + "I heard %s", data.data)',
	'',
	'def listener():',
	'    \'\'\'${node_name} Subscriber\'\'\'',
	'    # In ROS, nodes are uniquely named. If two nodes with the same',
	'    # node are launched, the previous one is kicked off. The',
	'    # anonymous=True flag means that rospy will choose a unique',
	'    # name for our \'listener\' node so that multiple listeners can',
	'    # run simultaneously.',
	'    rospy.init_node(\'${node_name}\', anonymous=True)',
	'',
	'    rospy.Subscriber("chatter", String, callback)',
	'',
	'    # spin() simply keeps python from exiting until this node is stopped',
	'    rospy.spin()',
	'',
	'if __name__ == \'__main__\':',
	'    listener()',
	''
].join('\n');

export const rosTemplateCppClassDefine: string = [
	'class ${class_name}',
	'{',
	'public:',
	'\t${class_name}();',
	'\tvirtual ~${class_name}();',
	'};'
].join('\n');

export const rosTemplateCppClassImplement: string = [
	'#include "${class_name}.h"',
	'',
	'${class_name}::${class_name}()',
	'{',
	'}',
	'',
	'${class_name}::~${class_name}()',
	'{',
	'}'
].join('\n');

export const rosTemplateYcmConf: string = [
	'#!/usr/bin/env python',
	'',
	'import os',
	'import ycm_core',
	'',
	'flags = [',
	'\'-Wall\',',
	'\'-Wextra\',',
	'\'-Werror\',',
	'\'-fexceptions\',',
	'\'-DNDEBUG\',',
	'\'-std=c++11\',',
	'\'-x\',',
	'\'c++\',',
	'\'-isystem\',',
	'\'/usr/include\',',
	'\'-isystem\',',
	'\'/usr/local/include\',',
	'\'-isystem\',',
	'\'/opt/ros/\' + os.getenv(\'ROS_DISTRO\') + \'/include\',',
	'${ws_incs}',
	']',
	'',
	'compilation_database_folder = \'\'',
	'',
	'if os.path.exists( compilation_database_folder ):',
	'  database = ycm_core.CompilationDatabase( compilation_database_folder )',
	'else:',
	'  database = None',
	'',
	'SOURCE_EXTENSIONS = [ \'.cpp\', \'.cxx\', \'.cc\', \'.c\' ]',
	'',
	'def DirectoryOfThisScript():',
	'  return os.path.dirname( os.path.abspath( __file__ ) )',
	'',
	'',
	'def MakeRelativePathsInFlagsAbsolute( flags, working_directory ):',
	'  if not working_directory:',
	'    return list( flags )',
	'  new_flags = []',
	'  make_next_absolute = False',
	'  path_flags = [ \'-isystem\', \'-I\', \'-iquote\', \'--sysroot=\' ]',
	'  for flag in flags:',
	'    new_flag = flag',
	'',
	'    if make_next_absolute:',
	'      make_next_absolute = False',
	'      if not flag.startswith( \'/\' ):',
	'        new_flag = os.path.join( working_directory, flag )',
	'',
	'    for path_flag in path_flags:',
	'      if flag == path_flag:',
	'        make_next_absolute = True',
	'        break',
	'',
	'      if flag.startswith( path_flag ):',
	'        path = flag[ len( path_flag ): ]',
	'        new_flag = path_flag + os.path.join( working_directory, path )',
	'        break',
	'',
	'    if new_flag:',
	'      new_flags.append( new_flag )',
	'  return new_flags',
	'',
	'',
	'def IsHeaderFile( filename ):',
	'  extension = os.path.splitext( filename )[ 1 ]',
	'  return extension in [ \'.h\', \'.hxx\', \'.hpp\', \'.hh\' ]',
	'',
	'',
	'def GetCompilationInfoForFile( filename ):',
	'  if IsHeaderFile( filename ):',
	'    basename = os.path.splitext( filename )[ 0 ]',
	'    for extension in SOURCE_EXTENSIONS:',
	'      replacement_file = basename + extension',
	'      if os.path.exists( replacement_file ):',
	'        compilation_info = database.GetCompilationInfoForFile(',
	'          replacement_file )',
	'        if compilation_info.compiler_flags_:',
	'          return compilation_info',
	'    return None',
	'  return database.GetCompilationInfoForFile( filename )',
	'',
	'',
	'def FlagsForFile( filename, **kwargs ):',
	'  if database:',
	'    compilation_info = GetCompilationInfoForFile( filename )',
	'    if not compilation_info:',
	'      return None',
	'',
	'    final_flags = MakeRelativePathsInFlagsAbsolute(',
	'      compilation_info.compiler_flags_,',
	'      compilation_info.compiler_working_dir_ )',
	'  else:',
	'    relative_to = DirectoryOfThisScript()',
	'    final_flags = MakeRelativePathsInFlagsAbsolute( flags, relative_to )',
	'',
	'  return {',
	'    \'flags\': final_flags,',
	'    \'do_cache\': True',
	'  }',
	''
].join('\n');

export class RosService implements IRosService {

	public _serviceBrand: any;

	public static ARGS_CACHE_SIZE = 32;

	constructor(
		@IWorkspaceContextService private contextService: IWorkspaceContextService
	) {
	}

	// init ROS workspace
	public initRosWs(path: string): TPromise<void> {
		const srcPath = join(path, 'src');	// create src folder
		return pfs.mkdirp(srcPath).then(() => {
			return new TPromise<void>((c, e) => {
				const execProc = exec('catkin_init_workspace', { cwd: srcPath }, (err, stdout, stderr) => {	// catkin_init_workspace
					if (err) {
						return e(err);
					}
				});
				execProc.on('exit', c);
				execProc.on('error', e);
			});
		}).then(() => {
			const libPath = join(path, 'devel', 'lib');	// create devel/lib folder
			pfs.mkdirp(libPath);
		}).then(() => {
			const isolatedPath = join(path, 'devel_isolated');	// create devel_isolated folder
			pfs.mkdirp(isolatedPath);
		}).then(() => {
			const libPath = join(path, 'el', 'lib');	// create el/lib folder
			pfs.mkdirp(libPath);
		}).then(() => {
			const isolatedPath = join(path, 'el_isolated');	// create el_isolated folder
			pfs.mkdirp(isolatedPath);
		}).then(() => {
			this.initConfiguration(path);
		}).then(() => {
			this.initRosWsYcmConf();
		});
	}

	// init the configuration of ROS workspace
	public initConfiguration(path: string): TPromise<void> {
		return pfs.mkdirp(join(path, '.vscode')).then(() => {
			pfs.writeFile(join(path, '.vscode', 'tasks.json'), taskTemplates[0].content, encoding.UTF8);
			pfs.writeFile(join(path, '.vscode', 'launch.json'), rosLaunchJson, encoding.UTF8);
		});
	}

	// init the YCM configuration of ROS workspace
	public initRosWsYcmConf(): TPromise<void> {
		const workspace = this.contextService.getWorkspace();
		if (!workspace) {
			return null;
		}
		const wsdevinc = `'-isystem',\n'${join(workspace.resource.fsPath, 'devel', 'include')}',\n`;
		const srcDir = join(workspace.resource.fsPath, 'src');
		return pfs.readDirsInDir(srcDir).then(children => {
			const wspkginc = children.map(val => `'-isystem',\n'${join(srcDir, val, 'include')}'`).join(',\n');
			pfs.writeFile(join(workspace.resource.fsPath, '.ycm_extra_conf.py'), rosTemplateYcmConf.replace('${ws_incs}', wsdevinc + wspkginc), encoding.UTF8);
		});
	}

	// create ROS package
	public addRosPkg(pkgName: string): TPromise<void> {
		const workspace = this.contextService.getWorkspace();
		if (!workspace || !pkgName) {
			return null;
		}
		return new TPromise<void>((c, e) => {
			const execProc = exec(`catkin_create_pkg ${pkgName}`, { cwd: join(workspace.resource.fsPath, 'src') }, (err, stdout, stderr) => {
				if (err) {
					return e(err);
				}
			});
			execProc.on('exit', c);
			execProc.on('error', e);
		});
	}

	// get the debug argument
	public getDebugArgs(name: string): TPromise<string> {
		const jsonPath = join(this.contextService.getWorkspace().resource.fsPath, '.vscode', 'launch.json');
		return pfs.readFile(jsonPath).then(buffer => {
			try {
				const jsonObject = JSON.parse(buffer.toString());
				for (let i = 0; i < jsonObject.configurations.length; i++) {
					if (jsonObject.configurations[i].name && jsonObject.configurations[i].name === name) {
						return jsonObject.configurations[i].arguments;
					}
				}
			} catch (error) { }
			return null;
		});
	}

	// set the debug argument
	public setDebugArgs(name: string, args: string): TPromise<void> {
		const jsonPath = join(this.contextService.getWorkspace().resource.fsPath, '.vscode', 'launch.json');
		return pfs.readFile(jsonPath).then(buffer => {
			let jsonString = buffer.toString();
			try {
				const jsonObject = JSON.parse(jsonString);
				for (let i = 0; i < jsonObject.configurations.length; i++) {
					if (jsonObject.configurations[i].name && jsonObject.configurations[i].name === name) {
						jsonObject.configurations[i].arguments = args;
					}
				}
				jsonString = JSON.stringify(jsonObject, null, '\t');
			} catch (error) { }
			pfs.writeFile(jsonPath, jsonString);
		});
	}

	// get the argument from cache
	public getArgsCache(): TPromise<string[]> {
		const jsonPath = join(this.contextService.getWorkspace().resource.fsPath, '.vscode', 'launch_args.json');
		return pfs.readFile(jsonPath).then(buffer => {
			try {
				const jsonObject = JSON.parse(buffer.toString());
				if (jsonObject.args) {
					return jsonObject.args;
				}
			} catch (error) { }
			return null;
		}, () => null);
	}

	// add argument to cache
	public addArgsToCache(args: string): TPromise<void> {
		const jsonPath = join(this.contextService.getWorkspace().resource.fsPath, '.vscode', 'launch_args.json');
		return pfs.readFile(jsonPath).then(buffer => {
			try {
				const jsonObject = JSON.parse(buffer.toString());
				if (jsonObject.args.indexOf(args) < 0) {
					jsonObject.args.unshift(args);	// new args at the beginning of cache
					jsonObject.args.splice(RosService.ARGS_CACHE_SIZE, jsonObject.args.length - RosService.ARGS_CACHE_SIZE);	// delete old args
					const jsonString = JSON.stringify(jsonObject, null, '\t');
					pfs.writeFile(jsonPath, jsonString);
				}
			} catch (error) { }
		}, () => {
			const jsonString = JSON.stringify({ args: [args] }, null, '\t');
			pfs.writeFile(jsonPath, jsonString);
		});
	}

	// get the active package name from cache, It's synchronous
	public getActivePkgNameCacheSync(): string[] {
		const jsonPath = join(this.contextService.getWorkspace().resource.fsPath, '.vscode', 'launch_args.json');
		try {
			const buffer = fs.readFileSync(jsonPath);
			const jsonObject = JSON.parse(buffer.toString());
			if (jsonObject.activePkgName && jsonObject.activePkgName.length > 0) {
				return jsonObject.activePkgName;
			}
		} catch (error) {
			return null;
		}
		return null;
	}

	// get the active package name from cache
	public getActivePkgNameCache(): TPromise<string[]> {
		const jsonPath = join(this.contextService.getWorkspace().resource.fsPath, '.vscode', 'launch_args.json');
		return pfs.readFile(jsonPath).then(buffer => {
			try {
				const jsonObject = JSON.parse(buffer.toString());
				if (jsonObject.activePkgName && jsonObject.activePkgName.length > 0) {
					return jsonObject.activePkgName;
				}
			} catch (error) { }
			return null;
		}, () => null);
	}

	// add the active package name to cache
	public addActivePkgNameToCache(pkgName: string): TPromise<void> {
		const jsonPath = join(this.contextService.getWorkspace().resource.fsPath, '.vscode', 'launch_args.json');
		return pfs.readFile(jsonPath).then(buffer => {
			try {
				const jsonObject = JSON.parse(buffer.toString());
				if (!jsonObject.activePkgName) {
					jsonObject.activePkgName = [];
				}
				if (jsonObject.activePkgName.indexOf(pkgName) < 0) {
					jsonObject.activePkgName.push(pkgName);
					const jsonString = JSON.stringify(jsonObject, null, '\t');
					pfs.writeFile(jsonPath, jsonString);
				}
			} catch (error) { }
		}, () => {
			const jsonString = JSON.stringify({ activePkgName: [pkgName] }, null, '\t');
			pfs.writeFile(jsonPath, jsonString);
		});
	}

	// delete the active package name from cache
	public delActivePkgNameFromCache(pkgName: string): TPromise<void> {
		const jsonPath = join(this.contextService.getWorkspace().resource.fsPath, '.vscode', 'launch_args.json');
		return pfs.readFile(jsonPath).then(buffer => {
			try {
				const jsonObject = JSON.parse(buffer.toString());
				if (!jsonObject.activePkgName) {
					return;
				}
				const idx = jsonObject.activePkgName.indexOf(pkgName);
				if (idx >= 0) {
					jsonObject.activePkgName.splice(idx, 1);
					const jsonString = JSON.stringify(jsonObject, null, '\t');
					pfs.writeFile(jsonPath, jsonString);
				}
			} catch (error) { }
		});
	}

	// clean all active package name from cache
	public cleanActivePkgNameFromCache(): TPromise<void> {
		const jsonPath = join(this.contextService.getWorkspace().resource.fsPath, '.vscode', 'launch_args.json');
		return pfs.readFile(jsonPath).then(buffer => {
			try {
				const jsonObject = JSON.parse(buffer.toString());
				if (jsonObject.activePkgName) {
					delete jsonObject.activePkgName;
					const jsonString = JSON.stringify(jsonObject, null, '\t');
					pfs.writeFile(jsonPath, jsonString);
				}
			} catch (error) { }
		});
	}

	// get the remote argument from cache
	public getRemoteArgsCache(): TPromise<any> {
		const jsonPath = join(this.contextService.getWorkspace().resource.fsPath, '.vscode', 'launch_args.json');
		return pfs.readFile(jsonPath).then(buffer => {
			try {
				const jsonObject = JSON.parse(buffer.toString());
				if (jsonObject.remoteArgs) {
					return jsonObject.remoteArgs;
				}
			} catch (error) { }
			return null;
		}, () => null);
	}

	// set the remote argument to cache
	public setRemoteArgsToCache(host: string, user: string, keyfile: string, cwd: string): TPromise<void> {
		const jsonPath = join(this.contextService.getWorkspace().resource.fsPath, '.vscode', 'launch_args.json');
		return pfs.readFile(jsonPath).then(buffer => {
			try {
				const jsonObject = JSON.parse(buffer.toString());
				let isChanged: boolean = false;
				if (!jsonObject.remoteArgs) {
					jsonObject.remoteArgs = {};
				}
				if (!jsonObject.remoteArgs.host || jsonObject.remoteArgs.host !== host) {
					jsonObject.remoteArgs.host = host;
					isChanged = true;
				}
				if (!jsonObject.remoteArgs.user || jsonObject.remoteArgs.user !== user) {
					jsonObject.remoteArgs.user = user;
					isChanged = true;
				}
				if (!jsonObject.remoteArgs.keyfile || jsonObject.remoteArgs.keyfile !== keyfile) {
					jsonObject.remoteArgs.keyfile = keyfile;
					isChanged = true;
				}
				if (!jsonObject.remoteArgs.cwd || jsonObject.remoteArgs.cwd !== cwd) {
					jsonObject.remoteArgs.cwd = cwd;
					isChanged = true;
				}
				if (isChanged) {
					const jsonString = JSON.stringify(jsonObject, null, '\t');
					pfs.writeFile(jsonPath, jsonString);
				}
			} catch (error) { }
		}, () => {
			const jsonString = JSON.stringify({ remoteArgs: { host: host, user: user, keyfile: keyfile, cwd: cwd } }, null, '\t');
			pfs.writeFile(jsonPath, jsonString);
		});
	}

	// get Build Task Name list
	public getBuildTaskNames(isCatkinBuild: boolean): TPromise<TaskName[]> {
		const jsonPath = join(this.contextService.getWorkspace().resource.fsPath, '.vscode', 'tasks.json');
		return pfs.readFile(jsonPath).then(buffer => {
			try {
				const jsonTasks = JSON.parse(buffer.toString()).tasks;
				let names: TaskName[] = [];
				for (let i = 0; i < jsonTasks.length; i++) {
					if ((jsonTasks[i].taskName.indexOf('Deploy') > 0 || jsonTasks[i].taskName.indexOf('catkin') > 0 === isCatkinBuild) &&
						(!jsonTasks[i].isTestCommand || jsonTasks[i].isBuildCommand)) {
						names.push({ name: jsonTasks[i].taskName, isBuildCommand: jsonTasks[i].isBuildCommand });
					}
				}
				return names;
			} catch (error) { }
			return null;
		});
	}

	// set the default Build Task
	public setBuildTask(taskName: string): TPromise<void> {
		const jsonPath = join(this.contextService.getWorkspace().resource.fsPath, '.vscode', 'tasks.json');
		return pfs.readFile(jsonPath).then(buffer => {
			try {
				const jsonObject = JSON.parse(buffer.toString());
				const jsonTasks = jsonObject.tasks;
				let isChanged: boolean = false;
				for (let i = 0; i < jsonTasks.length; i++) {
					if (jsonTasks[i].taskName === taskName) {
						if (!jsonTasks[i].isBuildCommand) {
							jsonTasks[i].isBuildCommand = true;
							isChanged = true;
						}
					} else if (jsonTasks[i].isBuildCommand) {
						delete jsonTasks[i].isBuildCommand;
						isChanged = true;
					}
				}
				if (isChanged) {
					const jsonString = JSON.stringify(jsonObject, null, '\t');
					pfs.writeFile(jsonPath, jsonString);
				}
			} catch (error) { }
		});
	}

	// set tasks arguments
	private setTasksArgs(activePkgName: string[], host: string, user: string, cwd: string): TPromise<void> {
		const jsonPath = join(this.contextService.getWorkspace().resource.fsPath, '.vscode', 'tasks.json');
		return pfs.readFile(jsonPath).then(buffer => {
			try {
				const jsonObject = JSON.parse(buffer.toString());
				const jsonTasks = jsonObject.tasks;
				let isChanged: boolean = false;
				for (let i = 0; i < jsonTasks.length; i++) {
					let args;
					switch (jsonTasks[i].taskName) {
						case 'Debug':
							args = `catkin_make${activePkgName ? ' --pkg ' + activePkgName.join(' ') : ''} -C \${workspaceRoot} -DCMAKE_BUILD_TYPE=Debug`;
							break;
						case 'Release':
							args = `catkin_make${activePkgName ? ' --pkg ' + activePkgName.join(' ') : ''} -C \${workspaceRoot}`;
							break;
						case 'Debug (isolated)':
							args = `catkin_make_isolated${activePkgName ? ' --pkg ' + activePkgName.join(' ') : ''} -C \${workspaceRoot} -DCMAKE_BUILD_TYPE=Debug`;
							break;
						case 'Release (isolated)':
							args = `catkin_make_isolated${activePkgName ? ' --pkg ' + activePkgName.join(' ') : ''} -C \${workspaceRoot}`;
							break;
						case 'Debug (remote)':
							if (!host || !user || !cwd) {
								continue;
							}
							args = `ssh ${user}@${host} 'echo -e \"#!/bin/bash --login\\ncatkin_make${activePkgName ? ' --pkg ' + activePkgName.join(' ') : ''} -C ${cwd} -DCMAKE_BUILD_TYPE=Debug\" > /tmp/roswstmp.sh; chmod 755 /tmp/roswstmp.sh; /tmp/roswstmp.sh'; rsync -avz --delete --exclude=\"*.swp\" ${activePkgName ? activePkgName.map(val => `${user}@${host}:${cwd}/devel/lib/${val}`).join(' ') : `${user}@${host}:${cwd}/devel/lib/\\*`} \${workspaceRoot}/el/lib`;
							break;
						case 'Release (remote)':
							if (!host || !user || !cwd) {
								continue;
							}
							args = `ssh ${user}@${host} 'echo -e \"#!/bin/bash --login\\ncatkin_make${activePkgName ? ' --pkg ' + activePkgName.join(' ') : ''} -C ${cwd}\" > /tmp/roswstmp.sh; chmod 755 /tmp/roswstmp.sh; /tmp/roswstmp.sh'; rsync -avz --delete --exclude=\"*.swp\" ${activePkgName ? activePkgName.map(val => `${user}@${host}:${cwd}/devel/lib/${val}`).join(' ') : `${user}@${host}:${cwd}/devel/lib/\\*`} \${workspaceRoot}/el/lib`;
							break;
						case 'Debug (remote isolated)':
							if (!host || !user || !cwd) {
								continue;
							}
							args = `ssh ${user}@${host} 'echo -e \"#!/bin/bash --login\\ncatkin_make_isolated${activePkgName ? ' --pkg ' + activePkgName.join(' ') : ''} -C ${cwd} -DCMAKE_BUILD_TYPE=Debug\" > /tmp/roswstmp.sh; chmod 755 /tmp/roswstmp.sh; /tmp/roswstmp.sh'; rsync -avz --delete --exclude=\"*.swp\" ${activePkgName ? activePkgName.map(val => `${user}@${host}:${cwd}/devel_isolated/${val}`).join(' ') : `${user}@${host}:${cwd}/devel_isolated/\\*`} \${workspaceRoot}/el_isolated`;
							break;
						case 'Release (remote isolated)':
							if (!host || !user || !cwd) {
								continue;
							}
							args = `ssh ${user}@${host} 'echo -e \"#!/bin/bash --login\\ncatkin_make_isolated${activePkgName ? ' --pkg ' + activePkgName.join(' ') : ''} -C ${cwd}\" > /tmp/roswstmp.sh; chmod 755 /tmp/roswstmp.sh; /tmp/roswstmp.sh'; rsync -avz --delete --exclude=\"*.swp\" ${activePkgName ? activePkgName.map(val => `${user}@${host}:${cwd}/devel_isolated/${val}`).join(' ') : `${user}@${host}:${cwd}/devel_isolated/\\*`} \${workspaceRoot}/el_isolated`;
							break;
						case 'Debug (catkin)':
							args = `catkin build${activePkgName ? ' ' + activePkgName.join(' ') : ''} -w \${workspaceRoot} -DCMAKE_BUILD_TYPE=Debug`;
							break;
						case 'Release (catkin)':
							args = `catkin build${activePkgName ? ' ' + activePkgName.join(' ') : ''} -w \${workspaceRoot}`;
							break;
						case 'Debug (remote catkin)':
							if (!host || !user || !cwd) {
								continue;
							}
							args = `ssh ${user}@${host} 'echo -e \"#!/bin/bash --login\\ncatkin build${activePkgName ? ' ' + activePkgName.join(' ') : ''} -w ${cwd} -DCMAKE_BUILD_TYPE=Debug\" > /tmp/roswstmp.sh; chmod 755 /tmp/roswstmp.sh; /tmp/roswstmp.sh'; rsync -avzL --delete --exclude=\"*.swp\" ${activePkgName ? activePkgName.map(val => `${user}@${host}:${cwd}/devel/lib/${val}`).join(' ') : `${user}@${host}:${cwd}/devel/lib/\\*`} \${workspaceRoot}/el/lib`;
							break;
						case 'Release (remote catkin)':
							if (!host || !user || !cwd) {
								continue;
							}
							args = `ssh ${user}@${host} 'echo -e \"#!/bin/bash --login\\ncatkin build${activePkgName ? ' ' + activePkgName.join(' ') : ''} -w ${cwd}\" > /tmp/roswstmp.sh; chmod 755 /tmp/roswstmp.sh; /tmp/roswstmp.sh'; rsync -avzL --delete --exclude=\"*.swp\" ${activePkgName ? activePkgName.map(val => `${user}@${host}:${cwd}/devel/lib/${val}`).join(' ') : `${user}@${host}:${cwd}/devel/lib/\\*`} \${workspaceRoot}/el/lib`;
							break;
						case 'Remote Deploy':
							if (!host || !user || !cwd) {
								continue;
							}
							args = activePkgName ? `rsync -avz --delete --exclude=\"*.swp\" ${activePkgName.map(val => `\${workspaceRoot}/src/${val}`).join(' ')} ${user}@${host}:${cwd}/src; echo \"Deploy Finished!\"` : `rsync -avz --delete --exclude=\"*.swp\" \${workspaceRoot}/src ${user}@${host}:${cwd}; ssh ${user}@${host} 'rm ${cwd}/src/CMakeLists.txt; echo -e \"#!/bin/bash --login\\ncatkin_init_workspace ${cwd}/src\" > /tmp/roswstmp.sh; chmod 755 /tmp/roswstmp.sh; /tmp/roswstmp.sh'; echo \"Deploy Finished!\"`;
							break;
						default:
							continue;
					}
					if (!jsonTasks[i].args[0] || jsonTasks[i].args[0] !== args) {
						jsonTasks[i].args[0] = args;
						isChanged = true;
					}
				}
				if (isChanged) {
					const jsonString = JSON.stringify(jsonObject, null, '\t');
					pfs.writeFile(jsonPath, jsonString);
				}
			} catch (error) { }
		});
	}

	// set the active package name
	public setActivePkgNameArgs(activePkgName: string[]): TPromise<void> {
		return this.getRemoteArgsCache().then(remoteArgs => {
			if (remoteArgs) {
				this.setTasksArgs(activePkgName, remoteArgs.host, remoteArgs.user, remoteArgs.cwd);
			} else {
				this.setTasksArgs(activePkgName, null, null, null);
			}
		});
	}

	// set remote tasks argument
	public setRemoteTasksArgs(host: string, user: string, keyfile: string, cwd: string): TPromise<void> {
		return this.getActivePkgNameCache().then(activePkgName => this.setTasksArgs(activePkgName, host, user, cwd));
	}

	// set remote launch argument
	public setRemoteLaunchArgs(host: string, user: string, keyfile: string, cwd: string): TPromise<void> {
		const jsonPath = join(this.contextService.getWorkspace().resource.fsPath, '.vscode', 'launch.json');
		return pfs.readFile(jsonPath).then(buffer => {
			try {
				const jsonObject = JSON.parse(buffer.toString());
				const jsonConfig = jsonObject.configurations;
				let isChanged: boolean = false;
				for (let i = 0; i < jsonConfig.length; i++) {
					if (jsonConfig[i].type === 'gdb' && jsonConfig[i].ssh) {
						if (!jsonConfig[i].ssh.host || jsonConfig[i].ssh.host !== host) {
							jsonConfig[i].ssh.host = host;
							isChanged = true;
						}
						if (!jsonConfig[i].ssh.user || jsonConfig[i].ssh.user !== user) {
							jsonConfig[i].ssh.user = user;
							isChanged = true;
						}
						if (!jsonConfig[i].ssh.keyfile || jsonConfig[i].ssh.keyfile !== keyfile) {
							jsonConfig[i].ssh.keyfile = keyfile;
							isChanged = true;
						}
						if (!jsonConfig[i].ssh.cwd || jsonConfig[i].ssh.cwd !== cwd) {
							jsonConfig[i].ssh.cwd = cwd;
							isChanged = true;
						}
					}
				}
				if (isChanged) {
					const jsonString = JSON.stringify(jsonObject, null, '\t');
					pfs.writeFile(jsonPath, jsonString);
				}
			} catch (error) { }
		});
	}

	// run command and get the results
	public getCmdResultList(command: string): TPromise<string[]> {
		return new TPromise<string[]>((c, e) => {
			exec(command, (err, stdout, stderr) => {	// run command
				if (err || stderr) {
					return e(err);
				}
				return c(stdout.toString().trim().replace(/\n+/g, '\n').split('\n'));
			});
		});
	}

	// create C++ ROS node
	public addCppNode(path: string, name: string): TPromise<any> {
		const pubFilePath = join(path, 'src', `${name}_pub.cpp`);
		return pfs.exists(pubFilePath).then((exists) => {
			if (exists) {
				return TPromise.wrapError(new Error(nls.localize('fileExists', "File name already exists!")));
			}
			const subFilePath = join(path, 'src', `${name}_sub.cpp`);
			return pfs.exists(subFilePath).then((exists) => {
				if (exists) {
					return TPromise.wrapError(new Error(nls.localize('fileExists', "File name already exists!")));
				}
				return pfs.mkdirp(join(path, 'src')).then(() =>
					pfs.writeFile(pubFilePath, rosTemplateCppPubNode.replace(/\${node_name}/g, name))
				).then(() =>
					pfs.writeFile(subFilePath, rosTemplateCppSubNode.replace(/\${node_name}/g, name))
					);
			});
		});
	}

	// create Python ROS node
	public addPythonNode(path: string, name: string): TPromise<any> {
		const pubFilePath = join(path, 'src', `${name}_pub.py`);
		return pfs.exists(pubFilePath).then((exists) => {
			if (exists) {
				return TPromise.wrapError(new Error(nls.localize('fileExists', "File name already exists!")));
			}
			const subFilePath = join(path, 'src', `${name}_sub.py`);
			return pfs.exists(subFilePath).then((exists) => {
				if (exists) {
					return TPromise.wrapError(new Error(nls.localize('fileExists', "File name already exists!")));
				}
				return pfs.mkdirp(join(path, 'src')).then(() =>
					pfs.writeFile(pubFilePath, rosTemplatePythonPubNode.replace(/\${node_name}/g, name))
				).then(() =>
					pfs.writeFile(subFilePath, rosTemplatePythonSubNode.replace(/\${node_name}/g, name))
					);
			});
		});
	}

	// create C++ class
	public addCppClass(path: string, pkgName: string, name: string): TPromise<any> {
		const headerFilePath = join(path, 'include', pkgName, `${name}.h`);
		return pfs.exists(headerFilePath).then((exists) => {
			if (exists) {
				return TPromise.wrapError(new Error(nls.localize('fileExists', "File name already exists!")));
			}
			const cppFilePath = join(path, 'src', `${name}.cpp`);
			return pfs.exists(cppFilePath).then((exists) => {
				if (exists) {
					return TPromise.wrapError(new Error(nls.localize('fileExists', "File name already exists!")));
				}
				return pfs.mkdirp(join(path, 'include', pkgName)).then(() =>
					pfs.mkdirp(join(path, 'src'))
				).then(() =>
					pfs.writeFile(headerFilePath, rosTemplateCppClassDefine.replace(/\${class_name}/g, name))
					).then(() =>
						pfs.writeFile(cppFilePath, rosTemplateCppClassImplement.replace(/\${class_name}/g, name))
					);
			});
		});
	}
}