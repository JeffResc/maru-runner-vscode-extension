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
        [
            { pattern: '**/tasks.{yaml,yml}' },
            { pattern: '**/tasks/*.{yaml,yml}' }
        ],
        codeLensProvider
    );

    // Register commands
    const refreshCommand = vscode.commands.registerCommand('maru-runner.refreshTasks', () => {
        taskProvider.refresh();
        vscode.window.showInformationMessage('Maru tasks refreshed');
    });


    // Watch for changes in task files
    const taskFileWatcher = vscode.workspace.createFileSystemWatcher('**/tasks.{yaml,yml}');
    const tasksDirWatcher = vscode.workspace.createFileSystemWatcher('**/tasks/*.{yaml,yml}');
    
    const refreshBoth = () => {
        taskProvider.refresh();
        codeLensProvider.refresh();
    };
    
    taskFileWatcher.onDidChange(refreshBoth);
    taskFileWatcher.onDidCreate(refreshBoth);
    taskFileWatcher.onDidDelete(refreshBoth);
    
    tasksDirWatcher.onDidChange(refreshBoth);
    tasksDirWatcher.onDidCreate(refreshBoth);
    tasksDirWatcher.onDidDelete(refreshBoth);

    // Auto-detect tasks on startup
    if (vscode.workspace.workspaceFolders) {
        taskProvider.refresh();
    }

    context.subscriptions.push(
        taskProviderDisposable,
        codeLensProviderDisposable,
        refreshCommand,
        taskFileWatcher,
        tasksDirWatcher
    );
}

export function deactivate() {}

export async function findTaskFiles(): Promise<string[]> {
    const config = vscode.workspace.getConfiguration('maru-runner');
    const taskFiles = config.get<string[]>('taskFiles', ['tasks.yaml', 'tasks.yml']);
    
    const foundFiles: string[] = [];
    
    if (vscode.workspace.workspaceFolders) {
        for (const folder of vscode.workspace.workspaceFolders) {
            // Search for specific task files
            for (const filename of taskFiles) {
                const pattern = new vscode.RelativePattern(folder, `**/${filename}`);
                const files = await vscode.workspace.findFiles(pattern);
                foundFiles.push(...files.map(f => f.fsPath));
            }
            
            // Search for any .yaml/.yml files in 'tasks' directories
            const tasksPattern = new vscode.RelativePattern(folder, '**/tasks/*.{yaml,yml}');
            const tasksFiles = await vscode.workspace.findFiles(tasksPattern);
            foundFiles.push(...tasksFiles.map(f => f.fsPath));
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
