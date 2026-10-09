import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import WelcomeScreen from './WelcomeScreen';
import ExamPortalMenu from './ExamPortalMenu';
import Login from './Login';
import Register from './Register';
import Exam from './exam';
import Result from './result';
import Password from './password';
import StudentProfile from './StudentProfile';
import NotesBook from './NotesBook';
import SupportCenter from './SupportCenter';
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
          onNavigateRegister={() => setCurrentScreen('register')}
          onNavigateSupport={() => { setSupportReturn('welcome'); setCurrentScreen('support'); }}
        />
      )}

      {currentScreen === 'examPortal' && (
        <ExamPortalMenu
          onNavigateExam={() => setCurrentScreen('login')}
          onNavigateResult={() => setCurrentScreen('result')}
          onNavigatePassword={() => setCurrentScreen('password')}
          onNavigateReadiness={() => { setSupportReturn('examPortal'); setCurrentScreen('readiness'); }}
          onBack={() => setCurrentScreen('welcome')}
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
          onBackHome={() => setCurrentScreen('examPortal')}
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
        <Password supabase={supabase} onBack={() => setCurrentScreen('examPortal')} />
      )}

      {currentScreen === 'studentProfile' && (
        <StudentProfile supabase={supabase} onBack={() => setCurrentScreen('welcome')} />
      )}

      {currentScreen === 'support' && (
        <SupportCenter onBack={() => setCurrentScreen(supportReturn)} />
      )}

      {currentScreen === 'readiness' && (
        <DeviceReadiness supabase={supabase} student={userData} onBack={() => setCurrentScreen(supportReturn)} />
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
        <Result supabase={supabase} studentData={userData} onBack={() => setCurrentScreen('examPortal')} />
      )}
    </div>
  );
}
