import * as vscode from "vscode";
import { ResxGroup } from "./resxParser";
import { renderTableHtml } from "./renderTable";

export class TablePanel {
  public static currentPanel: TablePanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public static show(groups: ResxGroup[]) {
    if (TablePanel.currentPanel) {
      TablePanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
      TablePanel.currentPanel.update(groups);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "lokalizatorTable",
      "Lokalizator",
      vscode.ViewColumn.One,
      { enableScripts: false, retainContextWhenHidden: true }
    );

    TablePanel.currentPanel = new TablePanel(panel);
    TablePanel.currentPanel.update(groups);
  }

  public update(groups: ResxGroup[]) {
    this.panel.webview.html = renderTableHtml(groups);
  }

  public dispose() {
    TablePanel.currentPanel = undefined;
    this.disposables.forEach((d) => d.dispose());
  }
}
