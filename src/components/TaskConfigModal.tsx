import React, { useState } from 'react';
import { X, Calendar, Clock, Target } from 'lucide-react';

interface TaskConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetConfig: (config: { date?: string; priority?: string }) => void;
  taskTitle: string;
}

type ConfigStep = 'date' | 'priority';
type Priority = 'high' | 'medium' | 'low';

export const TaskConfigModal: React.FC<TaskConfigModalProps> = ({
  isOpen,
  onClose,
  onSetConfig,
  taskTitle
}) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<Priority>('medium');
  const [currentStep, setCurrentStep] = useState<ConfigStep>('date');
  
  // Set default to today
  React.useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      setSelectedDate(today);
      setCurrentStep('date');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDateSubmit = () => {
    if (selectedDate) {
      setCurrentStep('priority');
    }
  };

  const handlePrioritySubmit = () => {
    onSetConfig({
      date: selectedDate,
      priority: selectedPriority
    });
    onClose();
  };

  const handleSkipDate = () => {
    setCurrentStep('priority');
  };

  const handleSkipPriority = () => {
    onSetConfig({
      date: selectedDate || undefined,
      priority: undefined
    });
    onClose();
  };

  const handleSkipAll = () => {
    onSetConfig({});
    onClose();
  };

  const renderDateStep = () => (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Set Due Date</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          Would you like to set a due date for <span className="font-semibold">"{taskTitle}"</span>?
        </p>
        
        <div className="relative">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-4 py-3 pl-12 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
            min={new Date().toISOString().split('T')[0]}
          />
          <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
        
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => {
              const today = new Date();
              setSelectedDate(today.toISOString().split('T')[0]);
            }}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              setSelectedDate(tomorrow.toISOString().split('T')[0]);
            }}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Tomorrow
          </button>
          <button
            onClick={() => {
              const nextWeek = new Date();
              nextWeek.setDate(nextWeek.getDate() + 7);
              setSelectedDate(nextWeek.toISOString().split('T')[0]);
            }}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Next Week
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSkipDate}
          className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
        >
          Skip Date
        </button>
        <button
          onClick={handleDateSubmit}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
        >
          Next: Set Priority
        </button>
      </div>
    </>
  );

  const renderPriorityStep = () => (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <Target className="w-5 h-5 text-purple-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Set Priority</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          What's the priority level for <span className="font-semibold">"{taskTitle}"</span>?
        </p>
        
        <div className="space-y-3">
          {[
            { value: 'high', label: 'High Priority', color: 'red', description: 'Urgent and important' },
            { value: 'medium', label: 'Medium Priority', color: 'yellow', description: 'Important but not urgent' },
            { value: 'low', label: 'Low Priority', color: 'green', description: 'Nice to have' }
          ].map((priority) => (
            <label
              key={priority.value}
              className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                selectedPriority === priority.value
                  ? `border-${priority.color}-300 bg-${priority.color}-50/80 shadow-lg`
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="priority"
                value={priority.value}
                checked={selectedPriority === priority.value}
                onChange={(e) => setSelectedPriority(e.target.value as Priority)}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-full ${ 
                priority.color === 'red' ? 'bg-red-500' :
                priority.color === 'yellow' ? 'bg-yellow-500' : 'bg-green-500'
              }`} />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{priority.label}</div>
                <div className="text-sm text-gray-600">{priority.description}</div>
              </div>
              {selectedPriority === priority.value && (
                <div className={`w-5 h-5 rounded-full ${
                  priority.color === 'red' ? 'bg-red-500' :
                  priority.color === 'yellow' ? 'bg-yellow-500' : 'bg-green-500'
                } flex items-center justify-center`}>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSkipPriority}
          className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
        >
          Skip Priority
        </button>
        <button
          onClick={handlePrioritySubmit}
          className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium"
        >
          Complete Setup
        </button>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in slide-in-from-bottom duration-300">
        <div className="p-6">
          {currentStep === 'date' ? renderDateStep() : renderPriorityStep()}
        </div>
        
        {/* Progress indicator */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full ${currentStep === 'date' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
            <div className={`w-2 h-2 rounded-full ${currentStep === 'priority' ? 'bg-purple-500' : 'bg-gray-300'}`}></div>
          </div>
          <div className="text-center mt-2">
            <button
              onClick={handleSkipAll}
              className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
            >
              Skip all and finish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};