import { Github, Twitter, ExternalLink } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-arcade-border bg-arcade-darker/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <h3 className="font-arcade text-lg mb-4">
              <span className="neon-text-pink">LINERA</span>
              <span className="neon-text-cyan"> ARCADE</span>
            </h3>
            <p className="text-gray-400 text-sm">
              On-chain arcade gaming powered by Linera microchains. 
              Play games, earn XP, and compete on the global leaderboard.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-arcade text-sm text-neon-cyan mb-4">RESOURCES</h4>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://linera.dev" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white text-sm flex items-center gap-2 transition-colors"
                >
                  Linera Docs
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a 
                  href="https://faucet.testnet-conway.linera.net" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white text-sm flex items-center gap-2 transition-colors"
                >
                  Conway Faucet
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a 
                  href="https://dynamic.xyz" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white text-sm flex items-center gap-2 transition-colors"
                >
                  Dynamic.xyz
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="font-arcade text-sm text-neon-cyan mb-4">CONNECT</h4>
            <div className="flex gap-4">
              <a 
                href="https://github.com/linera-io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-arcade-card border border-arcade-border flex items-center justify-center text-gray-400 hover:text-white hover:border-neon-cyan transition-all"
              >
                <Github className="w-5 h-5" />
              </a>
              <a 
                href="https://twitter.com/linaboratory" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-arcade-card border border-arcade-border flex items-center justify-center text-gray-400 hover:text-white hover:border-neon-cyan transition-all"
              >
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-arcade-border text-center">
          <p className="text-gray-500 text-sm">
            Built on <span className="text-neon-purple">Conway Testnet</span> • 
            Powered by <span className="text-neon-cyan">Linera</span> microchains
          </p>
        </div>
      </div>
    </footer>
  );
}
