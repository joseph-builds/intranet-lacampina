import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractAnswersMap(rawAnswers: any): Record<string, any> {
  if (!rawAnswers) return {};
  
  if (Array.isArray(rawAnswers)) {
    const result: Record<string, any> = {};
    for (const item of rawAnswers) {
      if (!item || item.is_metadata) continue;
      if (typeof item === 'object') {
        if (item.question_id) {
          result[item.question_id] = item;
        } else {
          Object.assign(result, item);
        }
      }
    }
    return result;
  }

  if (typeof rawAnswers === 'object') {
    return rawAnswers;
  }
  
  return {};
}

