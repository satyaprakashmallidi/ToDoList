import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Task {
  id: string;
  title: string;
  status: 'open' | 'in-progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

interface TaskStoreState {
  tasks: Task[];
}

interface TaskStoreContextType extends TaskStoreState {
  addTask: (title: string) => void;
  updateTaskStatus: (id: string, status: Task['status']) => void;
  deleteTask: (id: string) => void;
  getTaskStats: () => {
    total: number;
    open: number;
    inProgress: number;
    completed: number;
  };
}

const TaskStoreContext = createContext<TaskStoreContextType | undefined>(undefined);

const STORAGE_KEY = 'task-store-data';

const generateTaskId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const TaskStoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);

  // Load data from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setTasks(data.tasks.map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt)
        })));
      } catch (error) {
        console.error('Failed to load task store data:', error);
      }
    } else {
      // Initialize with sample tasks
      const sampleTasks: Task[] = [
        {
          id: generateTaskId(),
          title: 'i want to create a youtube video',
          status: 'open',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateTaskId(),
          title: 'I want to create a youtube video',
          status: 'completed',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      setTasks(sampleTasks);
    }
  }, []);

  // Save data to localStorage
  useEffect(() => {
    const data = {
      tasks: tasks.map(t => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString()
      }))
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [tasks]);

  const addTask = (title: string) => {
    const newTask: Task = {
      id: generateTaskId(),
      title,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setTasks(prev => [...prev, newTask]);
  };

  const updateTaskStatus = (id: string, status: Task['status']) => {
    setTasks(prev => prev.map(task => 
      task.id === id 
        ? { ...task, status, updatedAt: new Date() }
        : task
    ));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
  };

  const getTaskStats = () => {
    const total = tasks.length;
    const open = tasks.filter(t => t.status === 'open').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const completed = tasks.filter(t => t.status === 'completed').length;

    return { total, open, inProgress, completed };
  };

  const value: TaskStoreContextType = {
    tasks,
    addTask,
    updateTaskStatus,
    deleteTask,
    getTaskStats
  };

  return (
    <TaskStoreContext.Provider value={value}>
      {children}
    </TaskStoreContext.Provider>
  );
};

export const useTaskStore = () => {
  const context = useContext(TaskStoreContext);
  if (context === undefined) {
    throw new Error('useTaskStore must be used within a TaskStoreProvider');
  }
  return context;
};