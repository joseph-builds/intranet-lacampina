const fs = require('fs');

function findFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(findFiles(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = findFiles('src');
let changedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('course_id') && (
      content.includes('course_weekly_sections') || 
      content.includes('exams') || 
      content.includes('quizzes') || 
      content.includes('assignments') || 
      content.includes('attendance') ||
      content.includes('course_events') ||
      file.includes('WeeklyContentManager') ||
      file.includes('SectionForm') ||
      file.includes('ExamsList') ||
      file.includes('ExamSubmissions') ||
      file.includes('AttendanceManager') ||
      file.includes('AttendanceRecords')
     )) {
    
    const original = content;
    
    // Replace in query builders
    content = content.replace(/\.eq\(['"]course_id['"]/g, '.eq("modulo_id"');
    
    // Replace object keys for inserts
    content = content.replace(/course_id:\s*courseId/g, 'modulo_id: courseId');
    
    if (content !== original) {
      fs.writeFileSync(file, content);
      console.log('Updated', file);
      changedFiles++;
    }
  }
});
console.log('Total files updated:', changedFiles);
