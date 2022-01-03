import { App, Plugin, PluginManifest } from 'obsidian';
import { getPlugin } from "juggl-api";

import { keys } from './utils';
import "./map++";

// Remember to rename these classes and interfaces!

interface RoostSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: RoostSettings = {
	mySetting: 'default'
}

export default class Roost extends Plugin {
	settings: RoostSettings;

	public constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
	}

	async onload() {
		console.log("Loading roost");

		await this.loadSettings();

		this.addCommand({
			id: "patch-graphs",
			name: "Patch Graphs",
			callback: () => {
				this.updateGraphs();
			}
		});
	}

	onunload() {

	}

	private updateGraphs() {
		const cache = this.app.metadataCache
		const embeds = new Map<string, string[]>();
		for (const src of keys(cache.resolvedLinks)) {
			const metadata = cache.getCache(src);
			if (metadata.embeds) {
				embeds.set(src, metadata.embeds.map(({ link }) => `${link}.md`));
			}
		}

		const juggl = getPlugin(this.app);
		const graph = juggl.activeGraphs()?.[0];

		(window as any).graph = graph.viz

		const nodes = new Map<string, cytoscape.NodeSingular>();
		const outgoingEdges = new Map<string, Map<string, cytoscape.EdgeSingular>>();
		const incomingEdges = new Map<string, Map<string, cytoscape.EdgeSingular>>();

		for (const el of graph.viz.elements().toArray()) {
			const data = el.data();
			if (el.group() === "nodes") {
				nodes.set(data.id, el as cytoscape.NodeSingular);
			} else {
				const { source, target } = data;
				outgoingEdges.update(
					source,
					(v = new Map()) => {
						v.set(target, el as cytoscape.EdgeSingular);
						return v;
					}
				);
				incomingEdges.update(
					target,
					(v = new Map()) => {
						v.set(source, el as cytoscape.EdgeSingular);
						return v;
					}
				)
			}
		}

		const removed = new Set<string>();
		const remappedIds = new Map<string, string[]>();

		for (const [src, embedList] of embeds) {
			const parentId = `core:${src}`;
			const parent = nodes.get(parentId);

			if (!parent) {
				console.warn(`No node found for ${src}`, parentId, parent);
				continue;
			}

			for (const embed of embedList) {
				const childId = `core:${embed}`;
				const child = nodes.get(childId);

				if (!child) {
					console.warn(`No node found for ${embed}`, childId, child);
					continue
				}

				if (!removed.has(childId)) {
					removed.add(childId);
					child.remove();
				}

				const clone = child.clone().json() as any;
				clone.data.parent = parentId;
				clone.data.id = `roost:${parentId}>${childId}`;

				remappedIds.update(childId, (v = []) => [...v, clone.data.id]);

				graph.viz.add(clone);

				for (const edge of outgoingEdges.get(childId)?.values() ?? []) {
					if (edge.data().target === parentId) {
						continue;
					}

					const targetIds = remappedIds.get(edge.data().target) ?? [edge.data().target];

					for (const targetId of targetIds) {
						const clone = edge.clone().json() as any;

						clone.data.source = `roost:${parentId}>${childId}`;
						clone.data.target = targetId
						clone.data.id = `roost:${parentId}>${childId}->${targetId}`;

						console.log(`Remapping edge ${edge.data().id} to ${clone.data.id}`);

						graph.viz.add(clone);
					}
				}

				for (const edge of incomingEdges.get(childId)?.values() ?? []) {
					if (edge.data().source === parentId) {
						continue;
					}

					const sourceIds = remappedIds.get(edge.data().source) ?? [edge.data().source];

					for (const sourceId of sourceIds) {
						const clone = edge.clone().json() as any;

						clone.data.source = sourceId;
						clone.data.target = `roost:${parentId}>${childId}`;
						clone.data.id = `roost:${sourceId}->${parentId}>${childId}`;

						console.log(`Remapping edge ${edge.data().id} to ${clone.data.id}`);

						graph.viz.add(clone);
					}
				}
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

