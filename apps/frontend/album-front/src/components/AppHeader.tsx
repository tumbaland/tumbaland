import { useNavigate } from 'react-router-dom';
import { Header } from "@tumbaland/components/header";
import { createNavigationItems } from '../config/navigation';

const AppHeader = () => {
  const navigate = useNavigate();

  const handleMenuClick = () => {
    console.log('Menu clicked');
  };

  const handleAccountClick = () => {
    console.log('Account clicked');
  };

  const menuItems = createNavigationItems(navigate);

  return (
    <Header 
      title="Album"
      menuItems={menuItems}
      onMenuClick={handleMenuClick}
      onAccountClick={handleAccountClick}
    />
  );
};

export default AppHeader;
