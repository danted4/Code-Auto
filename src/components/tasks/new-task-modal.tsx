'use client';

/**
 * New Task Modal
 *
 * Modal for creating new tasks with CLI tool selection and configuration
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useTaskStore } from '@/store/task-store';

interface CLIConfigSchema {
  fields: ConfigField[];
}

interface ConfigField {
  name: string;
  label: string;
  type: 'select' | 'number' | 'boolean' | 'text';
  options?: { value: string; label: string }[];
  default?: any;
  description?: string;
}

interface CLIAdapter {
  name: string;
  displayName: string;
  configSchema: CLIConfigSchema;
}

interface NewTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewTaskModal({ open, onOpenChange }: NewTaskModalProps) {
  const { createTask } = useTaskStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cliTool, setCliTool] = useState<string>('mock');
  const [cliConfig, setCliConfig] = useState<Record<string, any>>({});
  const [requiresHumanReview, setRequiresHumanReview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [availableAdapters, setAvailableAdapters] = useState<CLIAdapter[]>([]);
  const [isLoadingAdapters, setIsLoadingAdapters] = useState(true);

  // Fetch available CLI adapters from API
  useEffect(() => {
    async function fetchAdapters() {
      try {
        const response = await fetch('/api/cli/adapters');
        const adapters = await response.json();
        setAvailableAdapters(adapters);

        // Set default CLI tool and config
        if (adapters.length > 0) {
          const defaultAdapter = adapters[0];
          setCliTool(defaultAdapter.name);

          // Set default config values
          const defaults: Record<string, any> = {};
          defaultAdapter.configSchema.fields.forEach((field: ConfigField) => {
            if (field.default !== undefined) {
              defaults[field.name] = field.default;
            }
          });
          setCliConfig(defaults);
        }
      } catch (error) {
        console.error('Failed to load CLI adapters:', error);
      } finally {
        setIsLoadingAdapters(false);
      }
    }

    if (open) {
      fetchAdapters();
    }
  }, [open]);

  // Get config schema for selected CLI
  const currentAdapter = availableAdapters.find(a => a.name === cliTool);
  const configSchema = currentAdapter?.configSchema || null;

  // Initialize config with defaults when CLI changes
  const handleCliChange = (newCli: string) => {
    setCliTool(newCli);

    // Set default values from schema
    const adapter = availableAdapters.find(a => a.name === newCli);
    if (adapter) {
      const defaults: Record<string, any> = {};
      adapter.configSchema.fields.forEach((field: ConfigField) => {
        if (field.default !== undefined) {
          defaults[field.name] = field.default;
        }
      });
      setCliConfig(defaults);
    } else {
      setCliConfig({});
    }
  };

  const handleConfigChange = (fieldName: string, value: any) => {
    setCliConfig(prev => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleCreate = async () => {
    if (!title.trim() || !description.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setIsCreating(true);

    try {
      await createTask({
        title,
        description,
        phase: 'planning',
        status: 'pending',
        subtasks: [],
        cliTool,
        cliConfig,
        requiresHumanReview,
        planApproved: false,
        locked: requiresHumanReview, // Lock if human review required
        metadata: {
          estimatedComplexity: 'medium',
        },
      });

      // Reset form
      setTitle('');
      setDescription('');
      setCliTool('amp');
      setCliConfig({});
      setRequiresHumanReview(false);

      onOpenChange(false);
    } catch (error) {
      alert('Failed to create task');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const renderConfigField = (field: any) => {
    const value = cliConfig[field.name] ?? field.default;

    switch (field.type) {
      case 'select':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            {field.description && (
              <p className="text-xs text-slate-400">{field.description}</p>
            )}
            <Select value={value} onValueChange={(v) => handleConfigChange(field.name, v)}>
              <SelectTrigger id={field.name}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt: any) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'boolean':
        return (
          <div key={field.name} className="flex items-center space-x-2">
            <Checkbox
              id={field.name}
              checked={value}
              onCheckedChange={(checked) => handleConfigChange(field.name, checked)}
            />
            <Label htmlFor={field.name} className="cursor-pointer">
              {field.label}
            </Label>
          </div>
        );

      case 'number':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            {field.description && (
              <p className="text-xs text-slate-400">{field.description}</p>
            )}
            <Input
              id={field.name}
              type="number"
              value={value}
              onChange={(e) => handleConfigChange(field.name, parseInt(e.target.value))}
            />
          </div>
        );

      case 'text':
      default:
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            {field.description && (
              <p className="text-xs text-slate-400">{field.description}</p>
            )}
            <Input
              id={field.name}
              value={value}
              onChange={(e) => handleConfigChange(field.name, e.target.value)}
            />
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-slate-900 text-white border-slate-700">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription className="text-slate-400">
            Configure your task and select the CLI tool to use for implementation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Task Name */}
          <div className="space-y-2">
            <Label htmlFor="title">Task Name *</Label>
            <Input
              id="title"
              placeholder="e.g., Implement user authentication"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-slate-800 border-slate-700"
            />
          </div>

          {/* Task Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe what needs to be done..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-slate-800 border-slate-700"
            />
          </div>

          {/* CLI Tool Selection */}
          <div className="space-y-2">
            <Label htmlFor="cli-tool">CLI Tool</Label>
            {isLoadingAdapters ? (
              <div className="text-sm text-slate-400">Loading CLI tools...</div>
            ) : (
              <Select value={cliTool} onValueChange={handleCliChange}>
                <SelectTrigger id="cli-tool" className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {availableAdapters.map((adapter) => (
                    <SelectItem key={adapter.name} value={adapter.name}>
                      {adapter.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Dynamic CLI Configuration */}
          {configSchema && configSchema.fields.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-700">
              <h4 className="text-sm font-medium">CLI Configuration</h4>
              {configSchema.fields.map(renderConfigField)}
            </div>
          )}

          {/* Human Review Checkbox */}
          <div className="flex items-start space-x-2 pt-4 border-t border-slate-700">
            <Checkbox
              id="human-review"
              checked={requiresHumanReview}
              onCheckedChange={(checked) => setRequiresHumanReview(checked as boolean)}
            />
            <div className="space-y-1">
              <Label htmlFor="human-review" className="cursor-pointer font-medium">
                Require human review for plan
              </Label>
              <p className="text-xs text-slate-400">
                Task will be locked until you approve the AI-generated plan
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !title.trim() || !description.trim()}
            className="bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            {isCreating ? 'Creating...' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
