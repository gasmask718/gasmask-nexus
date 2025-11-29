import { JoinOrganization } from '@/components/organization/JoinOrganization';
import { useNavigate } from 'react-router-dom';

export default function JoinOrg() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <JoinOrganization 
        onSuccess={() => {
          navigate('/portal');
        }} 
      />
    </div>
  );
}
