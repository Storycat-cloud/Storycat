import { Cat } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="py-12 border-t border-border">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-center group">
            <span className="text-xl font-black tracking-tighter uppercase italic text-white group-hover:text-primary transition-colors">
              Story<span className="text-primary group-hover:text-white transition-colors">cat</span>
            </span>
          </Link>

          <div className="flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#workflow" className="hover:text-foreground transition-colors">Workflow</a>
            <a href="#roles" className="hover:text-foreground transition-colors">Roles</a>
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>

          <p className="text-sm text-muted-foreground">
            © 2026 StoryCat. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
