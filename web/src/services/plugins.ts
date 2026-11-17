export interface PluginTool {
  id: string;
  name: string;
  description: string;
  requiredParameters: string[];
}

export interface PluginExecutionResult {
  success: boolean;
  summary: string;
  payload?: Record<string, string>;
}

export interface KanbanCard {
  id: string;
  title: string;
  column: 'To Do' | 'In Progress' | 'Done';
}

export interface JarvisPlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: string;
  isEnabled: boolean;
  isDemoIntegration?: boolean;
  getDeclaredTools: () => PluginTool[];
  executeTool: (toolId: string, params: Record<string, string>) => Promise<PluginExecutionResult>;
}

export class TrelloKanbanPlugin implements JarvisPlugin {
  id = 'plugin_trello_asana';
  name = 'Trello & Asana Project Kanban';
  version = '2.4.0';
  author = 'Stark Industries Automation';
  description =
    'Interactive Agile sprint board plugin demonstrating JARVIS tool registration, card creation, and workflow state transitions.';
  category = 'Project Management';
  isEnabled = true;
  isDemoIntegration = true;

  boardCards: KanbanCard[] = [
    { id: 'PROJ-101', title: 'Initialize Quantum Core telemetry streaming', column: 'In Progress' },
    { id: 'PROJ-102', title: 'Deploy Gemini 3.8 SSE proxy to Cloud Run', column: 'To Do' },
    { id: 'PROJ-103', title: 'Audit satellite uplink latency with VERONICA', column: 'Done' },
    { id: 'PROJ-104', title: 'Integrate Asana sprint milestone webhook', column: 'In Progress' },
  ];

  getDeclaredTools(): PluginTool[] {
    return [
      {
        id: 'list_board',
        name: 'List Kanban Board',
        description: 'Fetches current cards across sprint columns',
        requiredParameters: [],
      },
      {
        id: 'create_card',
        name: 'Create Card',
        description: 'Adds a new task card to the board',
        requiredParameters: ['title', 'column'],
      },
      {
        id: 'move_card',
        name: 'Move Card',
        description: 'Advances a card across To Do, In Progress, or Done',
        requiredParameters: ['card_id', 'column'],
      },
    ];
  }

  async executeTool(toolId: string, params: Record<string, string>): Promise<PluginExecutionResult> {
    if (toolId === 'list_board') {
      const formatted = this.boardCards.map((c) => `• [${c.id}] ${c.title} -> [${c.column}]`).join('\n');
      return {
        success: true,
        summary: `Fetched ${this.boardCards.length} cards from Stark Project Board:\n${formatted}`,
      };
    }

    if (toolId === 'create_card') {
      const title = (params.title || 'Untitled Task').trim();
      const rawCol = params.column || 'To Do';
      const column: KanbanCard['column'] =
        rawCol === 'In Progress' || rawCol === 'Done' ? rawCol : 'To Do';
      const id = `PROJ-${105 + this.boardCards.length}`;
      this.boardCards = [...this.boardCards, { id, title, column }];
      return {
        success: true,
        summary: `Created card [${id}] "${title}" in column [${column}].`,
        payload: { card_id: id, title, column },
      };
    }

    if (toolId === 'move_card') {
      const cardId = params.card_id || '';
      const targetCol = (params.column as KanbanCard['column']) || 'Done';
      const idx = this.boardCards.findIndex((c) => c.id.toLowerCase() === cardId.toLowerCase());
      if (idx === -1) {
        return { success: false, summary: `Card "${cardId}" not found.` };
      }
      const updated = [...this.boardCards];
      updated[idx] = { ...updated[idx], column: targetCol };
      this.boardCards = updated;
      return {
        success: true,
        summary: `Moved [${updated[idx].id}] "${updated[idx].title}" to [${targetCol}].`,
      };
    }

    return { success: false, summary: `Unknown tool: ${toolId}` };
  }
}

export class GitHubDevOpsPlugin implements JarvisPlugin {
  id = 'plugin_github_devops';
  name = 'GitHub & CI/CD Sentinel';
  version = '1.8.2';
  author = 'Stark Labs DevOps';
  description =
    'Demo DevOps extension showing repository health checks and workflow dispatch hooks via JARVIS Plugin API.';
  category = 'Developer Tools';
  isEnabled = true;
  isDemoIntegration = true;

  getDeclaredTools(): PluginTool[] {
    return [
      {
        id: 'repo_status',
        name: 'Repository Status',
        description: 'Inspects branch status and CI checks',
        requiredParameters: [],
      },
      {
        id: 'run_workflow',
        name: 'Trigger CI Workflow',
        description: 'Dispatches build verification suite',
        requiredParameters: ['workflow_name'],
      },
    ];
  }

  async executeTool(toolId: string, params: Record<string, string>): Promise<PluginExecutionResult> {
    if (toolId === 'repo_status') {
      return {
        success: true,
        summary: [
          '[DEMO PLUGIN OUTPUT - Connect GitHub Token for live repo telemetry]',
          'Repo: stark-industries/jarvis-cosmic-web',
          'Branch: main | Build: Vite + Express',
          'Target Runtimes: Cloud Run, Vercel, Netlify, Firebase',
        ].join('\n'),
      };
    }
    if (toolId === 'run_workflow') {
      const wf = params.workflow_name || 'production-verify';
      return {
        success: true,
        summary: `[DEMO] Workflow "${wf}" queued on runner. Configure a GitHub PAT webhook to trigger live Actions.`,
      };
    }
    return { success: false, summary: `Unknown tool: ${toolId}` };
  }
}

export class HomeAssistantPlugin implements JarvisPlugin {
  id = 'plugin_home_assistant';
  name = 'Home Assistant Bridge';
  version = '3.1.0';
  author = 'Home Assistant Community';
  description =
    'Smart Home automation schema ready for Home Assistant REST/WebSocket endpoint binding.';
  category = 'Smart Home';
  isEnabled = true;
  isDemoIntegration = true;

  getDeclaredTools(): PluginTool[] {
    return [
      {
        id: 'activate_scene',
        name: 'Activate Scene',
        description: 'Applies lighting & climate profile',
        requiredParameters: ['scene_name'],
      },
      {
        id: 'get_climate',
        name: 'Climate Snapshot',
        description: 'Reads local environmental profile',
        requiredParameters: [],
      },
    ];
  }

  async executeTool(toolId: string, params: Record<string, string>): Promise<PluginExecutionResult> {
    if (toolId === 'activate_scene') {
      const scene = params.scene_name || 'Stark Lab Focus';
      return {
        success: true,
        summary: `[DEMO BRIDGE] Scene "${scene}" applied locally. Connect a Home Assistant URL & Long-Lived Token for physical hardware control.`,
      };
    }
    if (toolId === 'get_climate') {
      return {
        success: true,
        summary: '[DEMO BRIDGE] Local Profile: 21.5°C | Humidity: 46% | Mode: Optimal',
      };
    }
    return { success: false, summary: `Unknown tool: ${toolId}` };
  }
}

export function createInitialPlugins(): JarvisPlugin[] {
  return [new TrelloKanbanPlugin(), new GitHubDevOpsPlugin(), new HomeAssistantPlugin()];
}
