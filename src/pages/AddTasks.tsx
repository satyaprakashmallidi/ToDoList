import React, { useState } from 'react';
import { Plus, Wand2, CheckCircle2, Sparkles, ArrowRight, Target } from 'lucide-react';
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
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const inputRef = React.useRef<HTMLInputElement>(null);

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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-6 shadow-xl">
            <Target className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-blue-600 mb-4">
            Create Your Task
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Transform your ideas into actionable tasks with our intelligent breakdown system
          </p>
        </div>

        {/* Main Task Creation Card */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8 mb-8">
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200/50 text-red-700 rounded-2xl animate-in slide-in-from-top duration-300">
              <div className="flex items-center justify-between">
                <span className="font-medium">{error}</span>
                {error.includes('AI') || error.includes('generate') || error.includes('Gemini') ? (
                  <button
                    onClick={() => {
                      setError(null);
                      handleAIBreakdown();
                    }}
                    disabled={loading}
                    className="ml-4 px-4 py-2 text-sm bg-red-100/80 hover:bg-red-200/80 text-red-700 rounded-xl border border-red-300/50 disabled:opacity-50 transition-all duration-200 font-medium"
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-green-50/80 backdrop-blur-sm border border-green-200/50 text-green-700 rounded-2xl animate-in slide-in-from-top duration-300">
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="font-medium">{successMessage}</span>
              </div>
            </div>
          )}

          {/* Task Input Section */}
          <div className="space-y-6">
            <div className="relative">
              <label htmlFor="task-input" className="block text-sm font-semibold text-gray-700 mb-3">
                What would you like to accomplish?
              </label>
              <textarea
                ref={inputRef}
                id="task-input"
                name="task-input"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder="Describe your task in detail... (e.g., Plan and execute a marketing campaign for our new product)"
                className="w-full px-6 py-4 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all duration-200 resize-none bg-white/80 backdrop-blur-sm text-gray-800 placeholder-gray-500"
                disabled={loading}
                rows={3}
                aria-label="Task description"
                aria-invalid={!!error}
                aria-describedby={error ? "task-error" : undefined}
              />
            </div>

            {/* Controls Section */}
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              <div className="flex-1">
                <label htmlFor="steps-select" className="block text-sm font-semibold text-gray-700 mb-2">
                  AI Breakdown Steps
                </label>
                <select
                  id="steps-select"
                  name="steps-select"
                  value={numSteps}
                  onChange={(e) => setNumSteps(Number(e.target.value))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all duration-200 bg-white/80 backdrop-blur-sm text-gray-800"
                  disabled={loading}
                  aria-label="Number of subtask steps"
                >
                  {[2, 3, 4, 5, 6].map(num => (
                    <option key={num} value={num}>{num} steps</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 sm:mt-6">
                <button
                  type="button"
                  onClick={handleAIBreakdown}
                  disabled={loading || !taskInput.trim()}
                  className="group flex-1 sm:flex-none px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 focus:outline-none focus:ring-4 focus:ring-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg transform hover:scale-105 active:scale-95"
                >
                  <div className="flex items-center justify-center space-x-2">
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform duration-200" />
                    )}
                    <span>AI Breakdown</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleAddTask}
                  disabled={loading || !taskInput.trim()}
                  className="group flex-1 sm:flex-none px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg transform hover:scale-105 active:scale-95"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
                    <span>Add Task</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Subtasks Selection Card */}
        {showSubtasks && generatedSubtasks.length > 0 && (
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8 animate-in slide-in-from-bottom duration-500">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-600 rounded-xl mb-4">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Generated Subtasks</h2>
              <p className="text-gray-600">Select the steps you want to include in your task</p>
            </div>
            
            <div className="grid gap-4 mb-8">
              {generatedSubtasks.map((subtask, index) => (
                <label
                  key={index}
                  htmlFor={`subtask-${index}`}
                  className={`group flex items-start gap-4 p-5 border-2 rounded-2xl cursor-pointer transition-all duration-200 ${
                    subtask.selected
                      ? 'border-purple-300 bg-purple-50/80 shadow-lg transform scale-[1.02]'
                      : 'border-gray-200 bg-white/50 hover:border-purple-200 hover:bg-purple-25/50'
                  }`}
                >
                  <div className="relative mt-1">
                    <input
                      type="checkbox"
                      id={`subtask-${index}`}
                      checked={subtask.selected}
                      onChange={() => handleSubtaskToggle(index)}
                      className="w-5 h-5 text-purple-600 border-2 border-gray-300 rounded-md focus:ring-purple-500 focus:ring-offset-0 transition-colors duration-200"
                    />
                    {subtask.selected && (
                      <CheckCircle2 className="absolute -inset-0.5 w-6 h-6 text-purple-500 animate-in zoom-in duration-200" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className={`block text-lg transition-colors duration-200 ${
                      subtask.selected ? 'text-purple-900 font-semibold' : 'text-gray-700 group-hover:text-purple-700'
                    }`}>
                      {subtask.title}
                    </span>
                  </div>
                </label>
              ))}
            </div>
            
            <div className="text-center">
              <button
                type="button"
                onClick={handleAddTask}
                disabled={loading}
                className="group inline-flex items-center space-x-3 px-8 py-4 bg-green-600 text-white rounded-2xl hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-xl transform hover:scale-105 active:scale-95"
              >
                <span>Create Task with Selected Steps</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
