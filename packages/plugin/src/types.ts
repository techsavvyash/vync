// Basic type declarations for Obsidian API
// This is a simplified version for development purposes

export interface TFile {
	path: string
	name: string
	extension: string
	stat: {
		mtime: number
		ctime: number
		size: number
	}
}

export interface TFolder {
	path: string
	name: string
	children: (TFile | TFolder)[]
	isRoot(): boolean
}

export interface TAbstractFile {
	path: string
	name: string
}

export interface Plugin {
	app: App
	addRibbonIcon(icon: string, title: string, callback: () => void): void
	addSettingTab(settingTab: PluginSettingTab): void
	loadData(): Promise<any>
	saveData(data: any): Promise<void>
	onunload(): void
}

export interface App {
	vault: {
		getFiles(): TFile[]
		on(event: string, callback: (file: TAbstractFile) => void): void
	}
}

export interface PluginSettingTab {
	app: App
	plugin: Plugin
	display(): void
}

export interface Setting {
	setName(name: string): Setting
	setDesc(desc: string): Setting
	addText(callback: (text: any) => Setting): Setting
	addSlider(callback: (slider: any) => Setting): Setting
	addToggle(callback: (toggle: any) => Setting): Setting
	addDropdown(callback: (dropdown: any) => Setting): Setting
}

export declare class Notice {
	constructor(message: string)
}

export declare function PluginSettingTab(app: App, plugin: Plugin): PluginSettingTab
export declare function Setting(containerEl: HTMLElement): Setting