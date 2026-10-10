import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import WelcomeScreen from './WelcomeScreen';
import ExamPortalScreen from './ExamPortalScreen';
import Login from './Login';
import Register from './Register';
import Exam from './exam';
import Result from './result';
import Password from './password';
import StudentProfile from './StudentProfile';
import NotesBook from './NotesBook';
import SupportCenter from './SupportCenter';
import StudentGuides from './StudentGuides';
import StudentNotifications from './StudentNotifications';
import DeviceReadiness from './DeviceReadiness';
import PreExamBiometricGate from './PreExamBiometricGate';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [userData, setUserData] = useState(null);
  const [currentExam, setCurrentExam] = useState(null);
  const [supportReturn, setSupportReturn] = useState('welcome');

  const handleLogout = () => {
    setUserData(null);
    setCurrentExam(null);
    setCurrentScreen('welcome');
  };

  return (
    <div className="app-main-wrapper" style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {currentScreen === 'welcome' && (
        <WelcomeScreen
          onNavigateExamPortal={() => setCurrentScreen('examPortal')}
          onNavigateResult={() => setCurrentScreen('result')}
          onNavigateRegister={() => setCurrentScreen('register')}
          onNavigatePassword={() => setCurrentScreen('password')}
          onNavigateProfile={() => setCurrentScreen('studentProfile')}
          onNavigateNotes={() => setCurrentScreen('notes')}
          onNavigateSupport={() => { setSupportReturn('welcome'); setCurrentScreen('support'); }}
          onNavigateGuides={() => setCurrentScreen('guides')}
          onNavigateNotifications={() => setCurrentScreen('notifications')}
          onNavigateReadiness={() => setCurrentScreen('readiness')}
        />
      )}

      {currentScreen === 'examPortal' && (
        <ExamPortalScreen
          onBackHome={() => setCurrentScreen('welcome')}
          onNavigateExam={() => setCurrentScreen('login')}
          onNavigateResult={() => setCurrentScreen('result')}
          onNavigatePassword={() => setCurrentScreen('password')}
          onNavigateReadiness={() => setCurrentScreen('readiness')}
        />
      )}

      {currentScreen === 'login' && (
        <Login
          supabase={supabase}
          onLoginSuccess={(studentInfo, examInfo) => {
            setUserData(studentInfo || null);
            setCurrentExam(examInfo || {
              id: 3,
              title: 'امتحان شهادة الدراسة الثانوية العامة',
              subject: 'تكنولوجيا'
            });
            setCurrentScreen('biometricGate');
          }}
          onBackHome={() => setCurrentScreen('welcome')}
        />
      )}

      {currentScreen === 'register' && (
        <Register
          supabase={supabase}
          onRegisterSuccess={() => setCurrentScreen('login')}
          onBack={() => setCurrentScreen('welcome')}
        />
      )}

      {currentScreen === 'password' && (
        <Password supabase={supabase} onBack={() => setCurrentScreen('welcome')} />
      )}

      {currentScreen === 'studentProfile' && (
        <StudentProfile supabase={supabase} onBack={() => setCurrentScreen('welcome')} />
      )}

      {currentScreen === 'support' && (
        <SupportCenter supabase={supabase} student={userData} onBack={() => setCurrentScreen(supportReturn)} onReadiness={() => setCurrentScreen('readiness')} />
      )}

      {currentScreen === 'guides' && (
        <StudentGuides onBack={() => setCurrentScreen('welcome')} />
      )}

      {currentScreen === 'notifications' && (
        <StudentNotifications onBack={() => setCurrentScreen('welcome')} />
      )}

      {currentScreen === 'readiness' && (
        <DeviceReadiness supabase={supabase} student={userData} onBack={() => setCurrentScreen('support')} />
      )}

      {currentScreen === 'biometricGate' && (
        <PreExamBiometricGate supabase={supabase} student={userData} exam={currentExam} onSuccess={() => setCurrentScreen('exam')} onBack={() => setCurrentScreen('welcome')} />
      )}

      {currentScreen === 'exam' && (
        <Exam
          supabase={supabase}
          student={userData}
          initialExam={currentExam || { id: 3, title: 'امتحان شهادة الدراسة الثانوية العامة', subject: 'تكنولوجيا' }}
          onLogout={handleLogout}
        />
      )}

      {currentScreen === 'notes' && (
        <NotesBook onBack={() => setCurrentScreen('welcome')} />
      )}

      {currentScreen === 'result' && (
        <Result supabase={supabase} studentData={userData} onBack={() => setCurrentScreen('welcome')} />
      )}
    </div>
  );
}
