import { useLocation, useNavigate } from "react-router-dom";

export const LoginSuccessRedirect = ({ defaultPath = "/dashboard" }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLoginSuccess = () => {
    const nextPath = location.state?.from?.pathname ?? defaultPath;
    navigate(nextPath, { replace: true });
  };

  return (
    <button type="button" onClick={handleLoginSuccess}>
      Complete login
    </button>
  );
};
