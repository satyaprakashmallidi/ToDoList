import React, { useState } from 'react';
import { Send, Plus, Upload, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';
import { useAuth } from '../contexts/AuthContext';
import { Task, SubTask } from '../types/tasks';
import { generateSubtasks } from '../lib/ai';

export const AddTasks: React.FC = () => {
  const [taskInput, setTaskInput] = useState('');
  const [numSteps, setNumSteps] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [generatedSubtasks, setGeneratedSubtasks] = useState<Array<{ title: string; selected: boolean }>>([]);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [showStepsDropdown, setShowStepsDropdown] = useState(false);
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Clear error when input changes
  React.useEffect(() => {
    if (error) setError(null);
    if (successMessage) setSuccessMessage(null);
  }, [taskInput]);

  // Clear error when user interacts with subtasks
  React.useEffect(() => {
    if (showSubtasks && error) {
      setError(null);
    }
  }, [showSubtasks, generatedSubtasks]);

  // Focus input on mount
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStepsDropdown(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowStepsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleStepsSelection = async (steps: number) => {
    setNumSteps(steps);
    setShowStepsDropdown(false);
    if (taskInput.trim()) {
      await handleAIBreakdown();
    } else {
      // If no input, focus on the input field to prompt user
      inputRef.current?.focus();
    }
  };

  const createTask = async (title: string, subtasks: string[] = []) => {
    if (!user) return;
    
    console.log('Creating task:', { title, subtasks, userId: user.id });

    try {
      // Create main task
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title,
          status: 'open',
          priority: 'medium', // Set default priority
          is_deleted: false, // Ensure not deleted
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (taskError) throw taskError;
      
      console.log('Task created successfully:', taskData);

      // Create subtasks if any
      if (subtasks.length > 0) {
        const subtaskRecords = subtasks.map((title, index) => ({
          task_id: taskData.id,
          title,
          status: 'open',
          order_index: index + 1, // Start from 1
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const { error: subtaskError } = await supabase
          .from('subtasks')
          .insert(subtaskRecords)
          .select();

        if (subtaskError) throw subtaskError;
      }

      setTaskInput('');
      setSuccessMessage(`Task "${title}" created successfully${subtasks.length ? ' with ' + subtasks.length + ' subtasks' : ''}`);
      
      // Navigate to tasks page with the new task ID
      setTimeout(() => {
        navigate('/app/tasks', { state: { newTaskId: taskData.id, showDateModal: true } });
      }, 500);
      
      return taskData;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  };

  const handleAIBreakdown = async () => {
    if (!taskInput.trim()) return;
    
    setLoading(true);
    try {
      const subtasks = await generateSubtasks(taskInput, numSteps);
      setError(null);
      setGeneratedSubtasks(subtasks.map(title => ({ title, selected: true })));
      setShowSubtasks(true);
    } catch (error) {
      console.error('Error breaking down task:', error);
      setError(error instanceof Error ? error.message : 'Failed to break down task');
    } finally {
      setLoading(false);
    }
  };

  const handleSubtaskToggle = (index: number) => {
    setGeneratedSubtasks(prev => 
      prev.map((subtask, i) => 
        i === index ? { ...subtask, selected: !subtask.selected } : subtask
      )
    );
  };

  // Helper function to renumber subtasks sequentially
  const renumberSubtasks = (subtasks: string[]): string[] => {
    // Check if subtasks follow the "N. Title" pattern (AI-generated format)
    const hasNumberedPattern = subtasks.every(title => /^\d+\.\s/.test(title));
    
    if (!hasNumberedPattern) {
      // If not following numbered pattern, return as-is
      return subtasks;
    }
    
    // Renumber the subtasks sequentially
    return subtasks.map((title, index) => {
      // Remove the original number and add new sequential number
      const titleWithoutNumber = title.replace(/^\d+\.\s*/, '');
      return `${index + 1}. ${titleWithoutNumber}`;
    });
  };

  const handleAddTask = async () => {
    if (!taskInput.trim()) return;
    
    setLoading(true);
    try {
      setError(null);
      if (showSubtasks && generatedSubtasks.length > 0) {
        const selectedSubtasks = generatedSubtasks
          .filter(st => st.selected)
          .map(st => st.title);
        
        // Automatically renumber selected subtasks if they follow numbered pattern
        const renumberedSubtasks = renumberSubtasks(selectedSubtasks);
        
        await createTask(taskInput, renumberedSubtasks);
      } else {
        await createTask(taskInput);
      }
      setShowSubtasks(false);
      setGeneratedSubtasks([]);
      setTaskInput('');
      setSuccessMessage('Task created successfully!');
    } catch (error) {
      console.error('Error adding task:', error);
      setError(error instanceof Error ? error.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f8fafc' }} className="min-h-screen">
      {/* Header */}
      <header className="flex items-center p-4 font-bold text-lg text-gray-900">
        Magic Teams
        <span className="ml-1 text-sm text-gray-600">▼</span>
      </header>


      {/* Main Content */}
      <div className="flex flex-col items-center justify-center text-center" style={{ height: '80vh' }}>
        <h1 className="text-2xl font-medium text-gray-900">Create New Task.</h1>
        
        {/* Error/Success Messages */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg max-w-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{error}</span>
              {error.includes('AI') || error.includes('generate') || error.includes('Gemini') ? (
                <button
                  onClick={() => {
                    setError(null);
                    handleAIBreakdown();
                  }}
                  disabled={loading}
                  className="ml-2 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded border border-red-300 disabled:opacity-50"
                >
                  Retry
                </button>
              ) : null}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg max-w-md">
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        )}

        {/* Search Bar - ChatGPT Style */}
        <div className="mt-5 w-full max-w-2xl mx-auto">
          <div className="relative bg-white shadow-sm flex w-full cursor-text flex-col items-center justify-center overflow-clip bg-clip-padding rounded-[28px] border border-gray-200">
            <div className="relative flex min-h-14 w-full items-center px-4">
              <div className="relative mr-3">
                <button 
                  type="button" 
                  onClick={() => setShowStepsDropdown(!showStepsDropdown)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>

                {/* Steps Dropdown */}
                {showStepsDropdown && (
                  <div 
                    ref={dropdownRef}
                    className="absolute top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px]"
                    style={{ zIndex: 20 }}
                  >
                    <div className="p-2 border-b border-gray-100">
                      <div className="text-xs text-gray-500 mb-2">Select number of steps to generate</div>
                      {[2, 3, 4, 5, 6].map((steps) => (
                        <button
                          key={steps}
                          onClick={() => handleStepsSelection(steps)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors flex items-center justify-between"
                        >
                          <span>{steps} Steps</span>
                          <span className="text-xs text-gray-400">AI breakdown</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 text-gray-900 max-h-52 overflow-auto">
                <input 
                  ref={inputRef}
                  type="text" 
                  placeholder="Ask anything" 
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddTask();
                    }
                  }}
                  className="w-full border-none outline-none text-base bg-transparent text-gray-900 placeholder-gray-400 py-3" 
                />
              </div>
              <div className="ml-3">
                <button 
                  aria-label="Send" 
                  type="button"
                  onClick={handleAddTask}
                  disabled={loading || !taskInput.trim()}
                  className="relative flex h-9 items-center justify-center rounded-full w-9 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-center">
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>


        {/* Subtasks Selection */}
        {showSubtasks && generatedSubtasks.length > 0 && (
          <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4 shadow max-w-2xl mx-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">AI Generated Subtasks</h2>
            <p className="text-gray-600 mb-4 text-sm">Select the steps you want to include in your task</p>
            
            <div className="space-y-2 mb-4">
              {generatedSubtasks.map((subtask, index) => (
                <label
                  key={index}
                  className={`flex items-start gap-2 p-3 border rounded cursor-pointer transition-all ${
                    subtask.selected
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-blue-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={subtask.selected}
                    onChange={() => handleSubtaskToggle(index)}
                    className="mt-0.5 w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className={`text-left text-sm ${subtask.selected ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>
                    {subtask.title}
                  </span>
                </label>
              ))}
            </div>
            
            <button
              type="button"
              onClick={handleAddTask}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {loading ? 'Creating...' : 'Create Task with Selected Steps'}
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
