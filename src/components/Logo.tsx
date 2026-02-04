import { Link } from "react-router-dom";
import { Cat } from "lucide-react";

const Logo = () => {
  return (
    <Link to="/" className="flex items-center group py-2">
      <span className="text-2xl font-black text-white tracking-tighter uppercase italic group-hover:text-primary transition-colors">
        Story<span className="text-primary group-hover:text-white transition-colors">cat</span>
      </span>
    </Link>
  );
};

export default Logo;
