export default function Footer() {
  return (
    <footer className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-6 mt-auto shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <p className="text-sm">
              © {new Date().getFullYear()} <span className="font-semibold text-blue-400">ComplianceAI Pro</span>. All rights reserved.
            </p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-sm">
              Powered By{' '}
              <a 
                href="https://grc-consulting-nine.vercel.app/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-bold text-blue-400 hover:text-blue-300 transition-colors hover:underline"
              >
                Mohamed Emam
              </a>
              {' '}- Compliance AI
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Advanced AI-Powered Sanctions Screening
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}