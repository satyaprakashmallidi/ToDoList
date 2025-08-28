import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Key, ExternalLink, Settings } from 'lucide-react';

export const Calendar: React.FC = () => {
  const [calApiKey, setCalApiKey] = useState<string>(() => {
    return localStorage.getItem('calcom-api-key') || '';
  });
  const [isConfigured, setIsConfigured] = useState<boolean>(() => {
    const apiKey = localStorage.getItem('calcom-api-key');
    return !!apiKey;
  });
  const [inputApiKey, setInputApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setInputApiKey(calApiKey);
    if (calApiKey && isConfigured) {
      fetchUserInfo(calApiKey);
    }
  }, [calApiKey, isConfigured]);

  const fetchUserInfo = async (apiKey: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('https://api.cal.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to authenticate with Cal.com API');
      }
      
      const data = await response.json();
      setUserInfo(data);
    } catch (err) {
      console.error('Error fetching user info:', err);
      setError('Failed to connect to Cal.com. Please check your API key.');
      setIsConfigured(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputApiKey.trim()) {
      localStorage.setItem('calcom-api-key', inputApiKey.trim());
      setCalApiKey(inputApiKey.trim());
      await fetchUserInfo(inputApiKey.trim());
      if (!error) {
        setIsConfigured(true);
      }
    }
  };

  const handleReset = () => {
    localStorage.removeItem('calcom-api-key');
    setCalApiKey('');
    setInputApiKey('');
    setUserInfo(null);
    setError('');
    setIsConfigured(false);
  };

  const getCalendarUrl = () => {
    if (userInfo?.user?.username) {
      return `https://cal.com/${userInfo.user.username}`;
    }
    return 'https://cal.com';
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-6 h-6 text-blue-600" />
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Calendar</h1>
        </div>
        {isConfigured && (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            Reconfigure
          </button>
        )}
      </div>

      {!isConfigured ? (
        /* Configuration Form */
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Your Cal.com</h2>
                <p className="text-gray-600 text-sm">
                  Enter your Cal.com API key to display your calendar
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* API Key Field */}
                <div>
                  <label htmlFor="apikey" className="block text-sm font-medium text-gray-700 mb-2">
                    Cal.com API Key
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      id="apikey"
                      value={inputApiKey}
                      onChange={(e) => setInputApiKey(e.target.value)}
                      placeholder="cal_live_..."
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <span className="text-xs text-gray-500 hover:text-gray-700">
                        {showApiKey ? 'Hide' : 'Show'}
                      </span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Get your API key from{' '}
                    <a
                      href="https://app.cal.com/settings/developer/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                    >
                      Cal.com Settings
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!inputApiKey.trim() || loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  {loading ? 'Connecting...' : 'Connect Calendar'}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-2">Don't have a Cal.com account?</p>
                  <a
                    href="https://cal.com/signup"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Sign up for Cal.com
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Cal.com Embedded Calendar */
        <div className="flex-1 flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Connecting to Cal.com...</p>
              </div>
            </div>
          ) : userInfo ? (
            <>
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <p className="text-sm text-green-800">
                    Connected to <strong>{userInfo.user?.name || userInfo.user?.username}</strong> on Cal.com
                  </p>
                </div>
              </div>

              <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <iframe
                  src={getCalendarUrl()}
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  title="Cal.com Calendar"
                  className="w-full h-full"
                  allow="camera; microphone; fullscreen; display-capture"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Please configure your Cal.com API key to view your calendar.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};