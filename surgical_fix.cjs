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
let changed = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // 1. Fix course_id to modulo_id in query strings and inserts (for exams, quizzes, sections, assignments, attendance, course_events, course_teachers)
  // We apply this broadly to .eq('course_id') and course_id:
  content = content.replace(/\.eq\(['"]course_id['"]/g, '.eq("modulo_id"');
  content = content.replace(/course_id:\s*courseId/g, 'modulo_id: courseId');

  // 2. Fix teacher_id to teacher_principal_id ONLY for 'courses' table queries!
  // In TeacherDetailView.tsx
  if (file.includes('TeacherDetailView.tsx')) {
    content = content.replace(/\.eq\(['"]teacher_id['"]/g, '.eq("teacher_principal_id"');
  }

  // In StudentCourses.tsx
  if (file.includes('StudentCourses.tsx')) {
    content = content.replace(/teacher_id/g, 'teacher_principal_id');
  }

  // In DirectivoDashboard.tsx (query is to course_teachers, so teacher_id is CORRECT! No change needed)
  
  // In CourseDetail.tsx
  if (file.includes('CourseDetail.tsx')) {
    content = content.replace(/\.eq\(['"]teacher_id['"]/g, '.eq("teacher_principal_id"');
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Fixed:', file);
    changed++;
  }
});

console.log('Total files surgically fixed:', changed);
