import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'yaml';
import { MaruTaskProvider } from './taskProvider';
import { MaruCodeLensProvider } from './codeLensProvider';
import { MaruTask, MaruTaskFile } from './types';

export function activate(context: vscode.ExtensionContext) {
    console.log('Maru Runner extension is now active!');

    // Register task provider
    const taskProvider = new MaruTaskProvider();
    const taskProviderDisposable = vscode.tasks.registerTaskProvider('maru', taskProvider);

    // Register code lens provider
    const codeLensProvider = new MaruCodeLensProvider();
    const codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
        { pattern: '**/tasks.{yaml,yml}' },
        codeLensProvider
    );

    // Register commands
    const refreshCommand = vscode.commands.registerCommand('maru-runner.refreshTasks', () => {
        taskProvider.refresh();
        vscode.window.showInformationMessage('Maru tasks refreshed');
    });

    const runTaskCommand = vscode.commands.registerCommand('maru-runner.runTask', async (task: MaruTask) => {
        const vsCodeTask = await taskProvider.createVSCodeTask(task, (task as any).file);
        if (vsCodeTask) {
            vscode.tasks.executeTask(vsCodeTask);
        }
    });

    const runTaskFromFileCommand = vscode.commands.registerCommand('maru-runner.runTaskFromFile', async (taskName: string, filePath: string) => {
        const taskFile = await parseTaskFile(filePath);
        if (taskFile) {
            const task = taskFile.tasks.find(t => t.name === taskName);
            if (task) {
                const maruTask: MaruTask = {
                    ...task,
                    file: filePath
                };
                const vsCodeTask = await taskProvider.createVSCodeTask(maruTask, filePath);
                if (vsCodeTask) {
                    vscode.tasks.executeTask(vsCodeTask);
                }
            }
        }
    });

    // Watch for changes in task files
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/tasks.{yaml,yml}');
    fileWatcher.onDidChange(() => {
        taskProvider.refresh();
        codeLensProvider.refresh();
    });
    fileWatcher.onDidCreate(() => {
        taskProvider.refresh();
        codeLensProvider.refresh();
    });
    fileWatcher.onDidDelete(() => {
        taskProvider.refresh();
        codeLensProvider.refresh();
    });

    // Auto-detect tasks on startup
    if (vscode.workspace.workspaceFolders) {
        taskProvider.refresh();
    }

    context.subscriptions.push(
        taskProviderDisposable,
        codeLensProviderDisposable,
        refreshCommand,
        runTaskCommand,
        runTaskFromFileCommand,
        fileWatcher
    );
}

export function deactivate() {}

export async function findTaskFiles(): Promise<string[]> {
    const config = vscode.workspace.getConfiguration('maru-runner');
    const taskFiles = config.get<string[]>('taskFiles', ['tasks.yaml', 'tasks.yml']);
    
    const foundFiles: string[] = [];
    
    if (vscode.workspace.workspaceFolders) {
        for (const folder of vscode.workspace.workspaceFolders) {
            for (const filename of taskFiles) {
                const pattern = new vscode.RelativePattern(folder, `**/${filename}`);
                const files = await vscode.workspace.findFiles(pattern);
                foundFiles.push(...files.map(f => f.fsPath));
            }
        }
    }
    
    return foundFiles;
}

export async function parseTaskFile(filePath: string): Promise<MaruTaskFile | null> {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = yaml.parse(content);
        
        if (!parsed || !parsed.tasks || !Array.isArray(parsed.tasks)) {
            return null;
        }
        
        return {
            path: filePath,
            variables: parsed.variables || [],
            tasks: parsed.tasks.map((task: any) => ({
                name: task.name,
                description: task.description || '',
                actions: task.actions || [],
                inputs: task.inputs || {},
                envPath: task.envPath,
                wait: task.wait
            })),
            includes: parsed.includes || []
        };
    } catch (error) {
        console.error(`Error parsing task file ${filePath}:`, error);
        return null;
    }
}
