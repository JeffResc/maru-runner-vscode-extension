# Maru Runner Tasks VSCode Extension

A Visual Studio Code extension that automatically detects [Maru Runner](https://github.com/defenseunicorns/maru-runner) task files and makes them available as native VSCode tasks.

## Features

- **Schema-based Detection**: Automatically detects any YAML file that matches the Maru Runner schema
- **Native Integration**: Converts Maru tasks into VSCode tasks that can be run from the Command Palette or Tasks view
- **CodeLens Integration**: Adds "Run" buttons directly in YAML files next to each task definition
- **Real-time Updates**: Watches for changes in task files and automatically refreshes the task list
- **Configurable**: Customize the Maru runner executable path and schema version
- **Full Maru Support**: Supports all Maru Runner features including:
  - Variables and environment variables
  - Task composition and includes
  - Command execution with various options
  - Wait conditions
  - Task inputs

## Installation

1. Download the latest `.vsix` file from [GitHub Releases](https://github.com/JeffResc/maru-runner-vscode-extension/releases)
2. In VSCode, go to Extensions tab (Ctrl+Shift+X)
3. Click the "..." menu in the Extensions view
4. Select "Install from VSIX..."
5. Choose the downloaded `.vsix` file

## Development Installation

1. Clone or download this extension
2. Open the extension folder in VSCode
3. Press `F5` to run the extension in a new Extension Development Host window
4. Or package the extension using `vsce package` and install the generated `.vsix` file

## Usage

### Automatic Task Detection

Once installed, the extension will automatically:
1. Search for all YAML files in your workspace
2. Validate each file against the Maru Runner schema
3. Parse valid Maru task definitions
4. Create corresponding VSCode tasks
5. Make them available in the Command Palette (`Ctrl+Shift+P` → "Tasks: Run Task")

### Running Tasks

You can run Maru tasks in several ways:

1. **CodeLens (Recommended)**: Click the "▶️ Run [task-name]" button that appears next to each task definition in YAML files
2. **Command Palette**: `Ctrl+Shift+P` → "Tasks: Run Task" → Select your Maru task
3. **Task Terminal**: `Ctrl+Shift+P` → "Tasks: Run Task" → Select "maru: your-task-name"
4. **Keyboard Shortcut**: Assign shortcuts to specific tasks via VSCode's keyboard shortcuts settings

### Task Files

The extension automatically detects any YAML file that conforms to the Maru Runner schema. Files can have any name and be located anywhere in your workspace, as long as they contain valid Maru task definitions.

Example task file structure:
```yaml
variables:
  - name: FOO
    default: foo

tasks:
  - name: default
    description: "Default task that runs first"
    actions:
      - cmd: echo "Hello from Maru!"
  
  - name: build
    description: "Build the project"
    actions:
      - cmd: go build -o bin/app
      - cmd: echo "Build complete"
  
  - name: test
    description: "Run tests"
    actions:
      - cmd: go test ./...
      - task: lint
  
  - name: lint
    actions:
      - cmd: golangci-lint run
```

## Configuration

The extension can be configured through VSCode settings:

### `maru-runner.executable`
- **Type**: `string`
- **Default**: Auto-detected (tries 'uds run' first, then 'run')
- **Description**: Path to the maru runner executable. If not specified, will try 'uds run' first, then fallback to 'run'

### `maru-runner.autoDetect`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Automatically detect and create tasks from tasks.yaml files

### `maru-runner.schemaVersion`
- **Type**: `string`
- **Default**: `"main"`
- **Description**: Git branch or tag to use for the maru-runner schema (e.g., 'main', 'v0.1.0')

Example settings.json:
```json
{
  "maru-runner.autoDetect": true,
  "maru-runner.schemaVersion": "main"
}
```

To use a specific schema version:
```json
{
  "maru-runner.schemaVersion": "v0.1.0"
}
```

To manually set the executable (overrides auto-detection):
```json
{
  "maru-runner.executable": "/usr/local/bin/uds run"
}
```

## Commands

### `maru-runner.refreshTasks`
Manually refresh the task list to pick up changes in task files.

### `maru-runner.runTaskFromFile`
Run a specific task from a task file. This command is used internally by the CodeLens feature to run tasks directly from YAML files.

## Supported Maru Features

The extension supports all major Maru Runner features:

- ✅ **Basic Tasks**: Simple command execution
- ✅ **Task Composition**: Tasks that call other tasks
- ✅ **Variables**: Support for variables and environment variables
- ✅ **Includes**: Local and remote task file includes
- ✅ **Task Inputs**: Parameterized tasks with inputs
- ✅ **Wait Conditions**: Network and cluster wait conditions
- ✅ **Command Options**: All command properties (mute, dir, env, retries, etc.)
- ✅ **File Watching**: Automatic refresh when task files change
- ✅ **Schema Validation**: Validates task files against the official Maru Runner schema

## Requirements

- Visual Studio Code 1.102.0 or higher
- Maru Runner installed and available in your PATH, or UDS CLI with Maru Runner support
- The extension will automatically detect whether to use 'uds run' or 'run' command

## Known Issues

- Remote includes require network access and may not work in all environments
- Some advanced Maru features may require manual task definition

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test the extension
5. Submit a pull request

## License

This extension is released under the MIT License.

## Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/JeffResc/maru-runner-vscode-extension).
