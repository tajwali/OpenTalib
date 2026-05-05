import { redirect } from 'next/navigation';
import { getUserRole } from '@/lib/auth/get-user-role';
import MatureStudentDashboard from '@/components/dashboard/MatureStudentDashboard';
import SchoolStudentDashboard from '@/components/dashboard/SchoolStudentDashboard';
import TeacherDashboard from '@/components/dashboard/TeacherDashboard';
import AdminDashboard from '@/components/dashboard/AdminDashboard';

export default async function Page() {
  const { user, role, displayName } = await getUserRole();

  if (!user) {
    redirect('/login');
  }

  const props = {
    userEmail: user.email,
    displayName: displayName ?? undefined,
  };

  switch (role) {
    case 'school_student':
      return <SchoolStudentDashboard {...props} />;
    case 'teacher':
      return <TeacherDashboard {...props} />;
    case 'admin':
      return <AdminDashboard {...props} userId={user.id} />;
    default:
      // mature_student or legacy 'student' role → generation dashboard
      return <MatureStudentDashboard {...props} />;
  }
}
