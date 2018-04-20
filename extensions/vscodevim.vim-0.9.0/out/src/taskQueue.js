"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
/**
 * TaskQueue
 *
 * Enqueue promises here. They will be run sequentially.
 */
class TaskQueue {
    constructor() {
        this._taskQueue = {};
    }
    _runTasks(queueName) {
        return __awaiter(this, void 0, void 0, function* () {
            while (this._taskQueue[queueName].tasks.length > 0) {
                let task = this._taskQueue[queueName].tasks[0];
                try {
                    task.isRunning = true;
                    yield task.promise();
                    task.isRunning = false;
                }
                catch (e) {
                    console.log(e);
                    console.log(e.stack);
                }
                finally {
                    this.removeTask(task);
                    if (task.highPriority) {
                        this._taskQueue[queueName].highPriorityCount--;
                    }
                }
            }
        });
    }
    get tasks() {
        let result = 0;
        for (const list in this._taskQueue) {
            if (this._taskQueue.hasOwnProperty(list)) {
                result += this._taskQueue[list].tasks.length;
            }
        }
        return result;
    }
    /**
     * Removes a task from the task queue.
     *
     * (Keep in mind that if the task is already running, the semantics of
     * promises don't allow you to stop it.)
     */
    removeTask(task) {
        let queueName = task.queue || "default";
        this._taskQueue[queueName].tasks.splice(_.findIndex(this._taskQueue[queueName].tasks, t => t === task), 1);
    }
    /**
     * Adds a task to the task queue.
     */
    enqueueTask(task) {
        let queueName = task.queue || "default";
        let otherTaskRunning = this._taskQueue[queueName] && _.filter(this._taskQueue[queueName].tasks, x => x.isRunning).length > 0;
        if (this._taskQueue[queueName]) {
            if (task.highPriority) {
                // Insert task as the last high priotity task.
                const numHighPriority = this._taskQueue[queueName].highPriorityCount;
                this._taskQueue[queueName].tasks.splice(numHighPriority, 0, task);
                this._taskQueue[queueName].highPriorityCount++;
            }
            else {
                this._taskQueue[queueName].tasks.push(task);
            }
        }
        else {
            this._taskQueue[queueName] = {
                tasks: [task],
                highPriorityCount: 0,
            };
        }
        if (!otherTaskRunning) {
            this._runTasks(queueName);
        }
    }
}
exports.taskQueue = new TaskQueue();
//# sourceMappingURL=taskQueue.js.map