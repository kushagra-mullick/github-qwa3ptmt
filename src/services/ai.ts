import { supabase } from '../supabase';

// Task categories and their associated keywords
const taskCategories = {
  work: ['meeting', 'presentation', 'report', 'email', 'client', 'project', 'deadline', 'office'],
  shopping: ['buy', 'purchase', 'grocery', 'store', 'mall', 'shop', 'market'],
  health: ['gym', 'workout', 'exercise', 'doctor', 'appointment', 'medical', 'fitness'],
  personal: ['call', 'visit', 'meet', 'family', 'friend', 'home'],
  errands: ['bank', 'post', 'pickup', 'drop', 'delivery', 'repair']
};

// Contextual patterns for task suggestions
const contextualPatterns = [
  {
    type: 'time',
    pattern: /\b(morning|afternoon|evening|tonight|today|tomorrow)\b/i,
    priority: 'high'
  },
  {
    type: 'location',
    pattern: /\b(at|in|near|by)\b/i,
    priority: 'medium'
  },
  {
    type: 'urgency',
    pattern: /\b(urgent|asap|important|priority)\b/i,
    priority: 'high'
  }
];

export interface TaskSuggestion {
  task: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  context?: {
    time?: string;
    location?: string;
    urgency?: boolean;
  };
}

/**
 * Analyzes task text and categorizes it based on keywords
 */
export function categorizeTask(taskText: string): string {
  const lowercaseText = taskText.toLowerCase();
  
  for (const [category, keywords] of Object.entries(taskCategories)) {
    if (keywords.some(keyword => lowercaseText.includes(keyword))) {
      return category;
    }
  }
  
  return 'other';
}

/**
 * Analyzes task context and returns priority and contextual information
 */
export function analyzeTaskContext(taskText: string): {
  priority: 'low' | 'medium' | 'high';
  context: Record<string, any>;
} {
  const context: Record<string, any> = {};
  let priorityScore = 0;

  contextualPatterns.forEach(pattern => {
    if (pattern.pattern.test(taskText)) {
      context[pattern.type] = true;
      priorityScore += pattern.priority === 'high' ? 2 : 1;
    }
  });

  let priority: 'low' | 'medium' | 'high' = 'low';
  if (priorityScore >= 3) priority = 'high';
  else if (priorityScore >= 1) priority = 'medium';

  return { priority, context };
}

/**
 * Generates task suggestions based on location and time
 */
export async function generateTaskSuggestions(
  latitude: number,
  longitude: number
): Promise<TaskSuggestion[]> {
  try {
    // Get nearby locations from user's bookmarks
    const { data: bookmarks } = await supabase
      .from('location_bookmarks')
      .select('*')
      .filter('latitude', 'gte', latitude - 0.01)
      .filter('latitude', 'lte', latitude + 0.01)
      .filter('longitude', 'gte', longitude - 0.01)
      .filter('longitude', 'lte', longitude + 0.01);

    const suggestions: TaskSuggestion[] = [];

    // Generate suggestions based on nearby bookmarks
    if (bookmarks?.length) {
      bookmarks.forEach(bookmark => {
        const suggestion: TaskSuggestion = {
          task: `Check tasks at ${bookmark.name}`,
          category: 'location',
          priority: 'medium',
          context: {
            location: bookmark.name
          }
        };
        suggestions.push(suggestion);
      });
    }

    // Add time-based suggestions
    const hour = new Date().getHours();
    if (hour >= 7 && hour <= 10) {
      suggestions.push({
        task: 'Morning routine tasks',
        category: 'personal',
        priority: 'high',
        context: { time: 'morning' }
      });
    } else if (hour >= 11 && hour <= 14) {
      suggestions.push({
        task: 'Lunch break tasks',
        category: 'personal',
        priority: 'medium',
        context: { time: 'lunch' }
      });
    } else if (hour >= 17 && hour <= 19) {
      suggestions.push({
        task: 'Evening errands',
        category: 'errands',
        priority: 'medium',
        context: { time: 'evening' }
      });
    }

    return suggestions;
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return [];
  }
}

/**
 * Processes natural language input to extract task details
 */
export function processNaturalLanguage(input: string): {
  task: string;
  location?: string;
  time?: string;
} {
  const timePattern = /\b(at|on|by)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\w+day|\d{1,2}(?:st|nd|rd|th)?)\b/i;
  const locationPattern = /\b(?:at|in|near|by)\s+([^,\.]+)/i;

  const timeMatch = input.match(timePattern);
  const locationMatch = input.match(locationPattern);

  return {
    task: input
      .replace(timePattern, '')
      .replace(locationPattern, '')
      .trim(),
    time: timeMatch ? timeMatch[2] : undefined,
    location: locationMatch ? locationMatch[1] : undefined
  };
}