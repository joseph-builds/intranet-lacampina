import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import Assignments from "./pages/Assignments";
import AssignmentReview from "./pages/AssignmentReview";
import Exams from "./pages/Exams";
import ExamTaking from "./pages/ExamTaking";
import ExamSubmissionsPage from "./pages/ExamSubmissionsPage";
import ExamGradingPage from "./pages/ExamGradingPage";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUserManagement from "./pages/AdminUserManagement";
import AdminCourseManagement from "./pages/AdminCourseManagement";
import Index from "./pages/Index";

// Parent imports
import ParentAdminPanel from "./pages/ParentAdminPanel";
import ParentStudentDetail from "./pages/ParentStudentDetail";
import ParentNotifications from "./pages/ParentNotifications";
import ParentProfile from "./pages/ParentProfile";
import ParentDocuments from "./pages/ParentDocuments";
import TeacherClassrooms from "./pages/teacher/TeacherClassrooms";
import TeacherClassroomDetail from "./pages/teacher/TeacherClassroomDetail";
import TutorDashboard from "./pages/TutorDashboard";
import DirectivoDashboard from "./pages/DirectivoDashboard";
import Calendar from "./pages/Calendar";

import Support from "./pages/Support";
import Library from "./pages/Library";
import NotFound from "./pages/NotFound";
import AdminBulkStudentImport from "./pages/AdminBulkStudentImport";
import AssignmentDetail from "./pages/AssignmentDetail";
import StudentDetailView from "./pages/StudentDetailView";
import TeacherDetailView from "./pages/TeacherDetailView";
import ParentStudentAssociation from "./pages/ParentStudentAssociation";
import CreateExam from "./pages/CreateExam";
import GradingView from "./pages/GradingView";
import AdminStudentManagement from "./pages/AdminStudentManagement";
import AdminMallaCurricular from "./pages/AdminMallaCurricular";
import AdminClassrooms from "./pages/AdminClassrooms";
import SectionManagement from "./pages/SectionManagement";
import MentalGames from "./pages/MentalGames";
import Classmates from "./pages/Classmates";
import Announcements from "./pages/Announcements";
import AdminBimestres from "./pages/AdminBimestres";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } />
            <Route path="/courses" element={
              <ProtectedRoute>
                <Courses />
              </ProtectedRoute>
            } />
            <Route path="/courses/:id" element={
              <ProtectedRoute>
                <CourseDetail />
              </ProtectedRoute>
            } />
            {/* Rutas para padres */}
            <Route path="/parent/admin" element={<ProtectedRoute><ParentAdminPanel /></ProtectedRoute>} />
            <Route path="/parent/children" element={<ProtectedRoute><ParentStudentAssociation /></ProtectedRoute>} />
            <Route path="/parent/student/:studentId" element={<ProtectedRoute><ParentStudentDetail /></ProtectedRoute>} />
            <Route path="/parent/notifications" element={<ProtectedRoute><ParentNotifications /></ProtectedRoute>} />
            <Route path="/parent/profile" element={<ProtectedRoute><ParentProfile /></ProtectedRoute>} />
            <Route path="/parent/documents" element={<ProtectedRoute><ParentDocuments /></ProtectedRoute>} />
            <Route path="/courses/:courseId/create-exam" element={
              <ProtectedRoute>
                <CreateExam />
              </ProtectedRoute>
            } />
            <Route path="/assignments" element={
              <ProtectedRoute>
                <Assignments />
              </ProtectedRoute>
            } />
            <Route path="/assignments/:id" element={
              <ProtectedRoute>
                <AssignmentDetail />
              </ProtectedRoute>
            } />
            <Route path="/assignments/:assignmentId/review" element={
              <ProtectedRoute>
                <AssignmentReview />
              </ProtectedRoute>
            } />
            <Route path="/assignment-review/:assignmentId" element={
              <ProtectedRoute>
                <AssignmentReview />
              </ProtectedRoute>
            } />
            <Route path="/grading/:submissionId" element={
              <ProtectedRoute>
                <GradingView />
              </ProtectedRoute>
            } />
            <Route path="/exams" element={
              <ProtectedRoute>
                <Exams />
              </ProtectedRoute>
            } />
            <Route path="/exams/:examId/take" element={
              <ProtectedRoute>
                <ExamTaking />
              </ProtectedRoute>
            } />
            <Route path="/exam-submissions/:examId" element={
              <ProtectedRoute>
                <ExamSubmissionsPage />
              </ProtectedRoute>
            } />
            <Route path="/exam-grading/:submissionId" element={
              <ProtectedRoute>
                <ExamGradingPage />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/teacher/classrooms" element={
              <ProtectedRoute>
                <TeacherClassrooms />
              </ProtectedRoute>
            } />
            <Route path="/teacher/classrooms/:id" element={
              <ProtectedRoute>
                <TeacherClassroomDetail />
              </ProtectedRoute>
            } />
            <Route path="/calendar" element={
              <ProtectedRoute>
                <Calendar />
              </ProtectedRoute>
            } />
            <Route path="/anuncios" element={
              <ProtectedRoute>
                <Announcements/>
              </ProtectedRoute>
            } />
            <Route path="/support" element={
              <ProtectedRoute>
                <Support />
              </ProtectedRoute>
            } />
            <Route path="/tutor-dashboard" element={
              <ProtectedRoute>
                <TutorDashboard />
              </ProtectedRoute>
            } />
            <Route path="/directivo-dashboard" element={
              <ProtectedRoute>
                <DirectivoDashboard />
              </ProtectedRoute>
            } />
            <Route path="/library" element={
              <ProtectedRoute>
                <Library />
              </ProtectedRoute>
            } />
            <Route path="/student/:studentId" element={
              <ProtectedRoute>
                <StudentDetailView />
              </ProtectedRoute>
            } />
            <Route path="/teacher/:teacherId" element={
              <ProtectedRoute>
                <TeacherDetailView />
              </ProtectedRoute>
            } />
            <Route path="/admin/bulk-import" element={
              <ProtectedRoute>
                <AdminBulkStudentImport />
              </ProtectedRoute>
            } />
            <Route path="/admin/courses" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminCourseManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminUserManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/students" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminStudentManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/malla-curricular" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminMallaCurricular />
              </ProtectedRoute>
            } />
            <Route path="/admin/classrooms" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminClassrooms />
              </ProtectedRoute>
            } />
            <Route path="/admin/section/:sectionId" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <SectionManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/bimestres" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminBimestres />
              </ProtectedRoute>
            } />
            <Route path="/admin/*" element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/mental-games" element={
              <ProtectedRoute>
                <MentalGames />
              </ProtectedRoute>
            } />
            <Route path="/classmates" element={
              <ProtectedRoute>
                <Classmates />
              </ProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
