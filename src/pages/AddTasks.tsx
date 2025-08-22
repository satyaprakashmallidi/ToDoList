import React, { useState } from 'react';
import { Send, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';
import { useAuth } from '../contexts/AuthContext';
import { Task, SubTask } from '../types/tasks';
import { generateSubtasks, determineOptimalSteps } from '../lib/ai';

export const AddTasks: React.FC = () => {
  const [taskInput, setTaskInput] = useState('');
  const [numSteps, setNumSteps] = useState('ai-decide' as string | number);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [generatedSubtasks, setGeneratedSubtasks] = useState<Array<{ title: string; selected: boolean }>>([]);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [showPlusOptions, setShowPlusOptions] = useState(false);
  const [showAIBreakdown, setShowAIBreakdown] = useState(false);
  const [showStepOptions, setShowStepOptions] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<{ [key: number]: boolean }>({});
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const stepsContainerRef = React.useRef<HTMLDivElement>(null);

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

  // Close all options with Escape key
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowPlusOptions(false);
        setShowAIBreakdown(false);
        setShowStepOptions(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleStepsSelection = (steps: string | number) => {
    setNumSteps(steps);
    setShowStepOptions(false);
    // Remove auto-generation - only generate when user clicks send
  };

  const handleAIBreakdownClick = () => {
    setShowPlusOptions(false);
    setShowAIBreakdown(true);
  };

  const handlePlusButtonClick = () => {
    if (showPlusOptions || showAIBreakdown) {
      // Close everything if any option is open
      setShowPlusOptions(false);
      setShowAIBreakdown(false);
      setShowStepOptions(false);
    } else {
      // Open first level options
      setShowPlusOptions(true);
    }
  };

  const handleAIWillDecideClick = () => {
    setShowStepOptions(!showStepOptions);
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
      let finalStepCount: number;
      
      if (numSteps === 'ai-decide') {
        // Let AI decide the optimal number of steps
        finalStepCount = await determineOptimalSteps(taskInput);
      } else {
        finalStepCount = numSteps as number;
      }
      
      const subtasks = await generateSubtasks(taskInput, finalStepCount);
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

  const handleStepCheck = (index: number, checked: boolean) => {
    setCheckedSteps(prev => ({
      ...prev,
      [index]: checked
    }));
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
      
      // If subtasks are already generated and shown, create task with selected subtasks
      if (showSubtasks && generatedSubtasks.length > 0) {
        const selectedSubtasks = generatedSubtasks
          .filter(st => st.selected)
          .map(st => st.title);
        
        // Automatically renumber selected subtasks if they follow numbered pattern
        const renumberedSubtasks = renumberSubtasks(selectedSubtasks);
        
        await createTask(taskInput, renumberedSubtasks);
        setShowSubtasks(false);
        setGeneratedSubtasks([]);
        setTaskInput('');
        setSuccessMessage('Task created successfully!');
      } else {
        // Generate AI breakdown first, then show subtasks for selection
        await handleAIBreakdown();
      }
    } catch (error) {
      console.error('Error adding task:', error);
      setError(error instanceof Error ? error.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Main Content */}
      <div className="flex flex-col items-center justify-center text-center px-4 sm:px-6 min-h-[60vh]">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-medium text-gray-900 mb-6 sm:mb-8">Create your task.</h2>
        
        {/* Error/Success Messages */}
        {error && (
          <div className="mt-4 p-3 sm:p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg max-w-md w-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
              <span className="text-sm font-medium">{error}</span>
              {error.includes('AI') || error.includes('generate') || error.includes('Gemini') ? (
                <button
                  onClick={() => {
                    setError(null);
                    handleAIBreakdown();
                  }}
                  disabled={loading}
                  className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded border border-red-300 disabled:opacity-50 transition-colors"
                >
                  Retry
                </button>
              ) : null}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 sm:p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg max-w-md w-full">
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        )}

        {/* Multi-Level Input Bar */}
        <div className="w-full max-w-2xl mx-auto relative">
          {/* Main Input Bar Container */}
          <div className={`bg-white border border-gray-200 transition-all duration-600 ease-in-out ${
            showAIBreakdown 
              ? 'shadow-sm' 
              : 'shadow-sm focus-within:shadow-lg'
          }`} style={{
            borderRadius: showAIBreakdown ? '1rem' : '2rem',
            transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            
            {/* Main Input Bar */}
            <form 
              className="p-2 flex items-center gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleAddTask();
              }}
            >
              {/* Plus Button */}
              <div className="flex items-center gap-3 flex-shrink-0 text-gray-500 pl-2">
                <button
                  type="button"
                  onClick={handlePlusButtonClick}
                  className={`border-0 bg-white text-gray-600 p-2 rounded-full cursor-pointer leading-none transition-all duration-400 ease-in-out hover:bg-blue-50 hover:text-blue-600 hover:shadow-sm ${
                    showPlusOptions || showAIBreakdown
                      ? 'transform rotate-45' 
                      : ''
                  }`}
                  title="Options"
                >
                  <Plus className="w-4 h-4 transition-transform duration-400 ease-in-out" />
                </button>
              </div>

              {/* Input */}
              <input
                ref={inputRef}
                className="appearance-none border-0 outline-0 py-1.5 flex-1 text-sm bg-transparent text-gray-900 placeholder-gray-400"
                type="text"
                placeholder="Describe your task..."
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddTask();
                  }
                }}
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={loading || !taskInput.trim()}
                className="flex-shrink-0 border-0 rounded-full py-2 px-2.5 bg-blue-500 text-white cursor-pointer leading-none transition-all duration-150 hover:brightness-105 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:translate-y-0 mr-1"
                title="Create Task"
              >
                <span className="sr-only">Create Task</span>
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>

            {/* AI Breakdown Steps Extension - No border separator */}
            <div className={`transition-all duration-600 cubic-bezier(0.4, 0, 0.2, 1) ${
              showAIBreakdown ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'
            }`} style={{ overflow: showStepOptions ? 'visible' : 'hidden' }}>
              <div className="px-4 py-3 relative" style={{
                transform: showAIBreakdown ? 'translateY(0)' : 'translateY(-10px)',
                transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
              }}>
                <div className="flex items-center justify-start">
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={handleAIWillDecideClick}
                      className={`px-4 py-2 text-sm font-medium rounded-full border transition-all duration-300 ${
                        numSteps === 'ai-decide' 
                          ? 'bg-purple-500 text-white border-purple-500' 
                          : typeof numSteps === 'number'
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {numSteps === 'ai-decide' ? 'AI will Decide' : `${numSteps} Steps`}
                    </button>

                    {/* Step Options Connected Directly to Button */}
                    {showStepOptions && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-gray-50 border border-gray-200 rounded-xl shadow-lg p-3 z-[60] animate-in slide-in-from-left-2 duration-300 w-48 sm:w-56">
                        {/* Small connector triangle pointing left to button - centered vertically */}
                        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-white border-l border-t border-gray-200 transform rotate-45"></div>
                      
                      <div className="flex flex-col gap-1.5">
                        {/* Let AI Decide Option */}
                        <button
                          type="button"
                          onClick={() => handleStepsSelection('ai-decide')}
                          className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-300 text-left ${
                            numSteps === 'ai-decide' 
                              ? 'bg-purple-500 text-white shadow-sm' 
                              : 'bg-gray-50 text-purple-500 hover:bg-purple-500 hover:text-white hover:shadow-sm'
                          }`}
                        >
                          ✨ Let AI Decide
                        </button>
                        
                        {/* Manual Step Options */}
                        {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((steps) => (
                          <button
                            key={steps}
                            type="button"
                            onClick={() => handleStepsSelection(steps)}
                            className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-300 text-left ${
                              numSteps === steps 
                                ? 'bg-blue-500 text-white shadow-sm' 
                                : 'bg-gray-50 text-blue-500 hover:bg-blue-500 hover:text-white hover:shadow-sm'
                            }`}
                          >
                            {steps} Steps
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* First Level Options - Positioned below plus button */}
          {showPlusOptions && !showAIBreakdown && (
            <div className="absolute left-6 top-full mt-1 z-50 animate-in slide-in-from-top-2 duration-300">
              {/* Small connector triangle pointing to plus button */}
              <div className="absolute -top-1 left-4 w-2 h-2 bg-white border-l border-t border-gray-200 transform rotate-45"></div>
              
              <button
                type="button"
                onClick={handleAIBreakdownClick}
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-500 rounded-lg hover:bg-blue-50 transition-all duration-300 shadow-sm whitespace-nowrap"
              >
                AI Breakdown Steps
              </button>
            </div>
          )}
        </div>


        {/* Generated Tasks Section - Enhanced Size & Fixed Scrolling */}
        {showSubtasks && generatedSubtasks.length > 0 && (
          <div className="mt-8 w-full max-w-[95%] sm:max-w-6xl mx-auto px-2 sm:px-4">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
              {/* Header */}
              <div className="px-6 py-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      Generated Task Steps
                    </h3>
                    <p className="text-sm text-gray-600">
                      Review and customize your AI-generated task breakdown
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>{generatedSubtasks.filter(st => st.selected).length} of {generatedSubtasks.length} selected</span>
                    </div>
                    <button
                      onClick={() => {
                        const allSelected = generatedSubtasks.every(st => st.selected);
                        setGeneratedSubtasks(prev => 
                          prev.map(st => ({ ...st, selected: !allSelected }))
                        );
                      }}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-2 hover:bg-blue-50 rounded-lg transition-colors ml-4"
                    >
                      {generatedSubtasks.every(st => st.selected) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Content - Fixed Height with Smooth Scrolling */}
              <div className="relative" style={{ height: 'clamp(400px, 50vh, 500px)' }}>
                <div 
                  ref={stepsContainerRef}
                  className="h-full overflow-y-auto overflow-x-hidden px-6 py-4 scroll-smooth"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#cbd5e1 transparent'
                  }}
                >
                  <div className="space-y-3 pb-8">
                    {generatedSubtasks.map((subtask, index) => (
                      <div
                        key={index}
                        id={`step-${index}`}
                        className={`group rounded-xl border will-change-transform ${
                          subtask.selected
                            ? 'border-blue-200 bg-blue-50/60 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <label 
                          className="flex items-center gap-4 p-4 sm:p-5 cursor-pointer touch-manipulation"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSubtaskToggle(index);
                          }}
                        >
                          {/* Enhanced Checkbox */}
                          <div className="flex-shrink-0">
                            <input
                              type="checkbox"
                              checked={subtask.selected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSubtaskToggle(index);
                              }}
                              className="sr-only"
                            />
                            <div 
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transform-gpu ${
                                subtask.selected
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'border-gray-300 group-hover:border-blue-400'
                              }`}
                            >
                              {subtask.selected && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>

                          {/* Step Content */}
                          <div className="flex-1 min-w-0">
                            <span className={`block text-base leading-relaxed ${
                              subtask.selected 
                                ? 'text-blue-900 font-medium' 
                                : 'text-gray-700 group-hover:text-gray-900'
                            }`}>
                              {subtask.title}
                            </span>
                          </div>
                          
                          {/* Step Number Badge */}
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transform-gpu ${
                            subtask.selected 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                          }`}>
                            {index + 1}
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scroll fade indicators - Fixed positioning */}
                <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-white via-white/80 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none"></div>
              </div>

              {/* Action Footer */}
              <div className="px-6 py-5 bg-gray-50/50 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row gap-4 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSubtasks(false);
                      setGeneratedSubtasks([]);
                    }}
                    className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddTask}
                    disabled={loading || !generatedSubtasks.some(st => st.selected)}
                    className="px-8 py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Creating Task...
                      </div>
                    ) : (
                      `Create Task with ${generatedSubtasks.filter(st => st.selected).length} Steps`
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
