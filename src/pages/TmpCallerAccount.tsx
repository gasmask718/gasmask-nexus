import { useParams } from 'react-router-dom';
import { StoreAccountWorkspace } from '@/pages/StoreDetail';
export default function TmpCallerAccount() {
  const { id } = useParams();
  return <StoreAccountWorkspace storeId={id || ''} />;
}
