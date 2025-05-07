import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-secondary">
      {/* Navigation */}
      <nav className="fixed w-full bg-primary text-secondary py-4 z-50">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">NettyHost</h1>
          <div className="space-x-6">
            <Link href="#features" className="hover:text-gray-300 transition">Features</Link>
            <Link href="#pricing" className="hover:text-gray-300 transition">Pricing</Link>
            <Link href="#contact" className="hover:text-gray-300 transition">Contact</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-primary text-secondary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-5xl font-bold mb-6">Premium Hosting Solutions</h2>
          <p className="text-xl mb-8 text-gray-300">Fast, reliable, and secure hosting for your business</p>
          <button className="bg-secondary text-primary px-8 py-3 rounded-lg font-semibold hover:bg-gray-200 transition">
            Get Started
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-secondary">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12 text-primary">Our Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 border border-gray-200 rounded-lg">
              <h3 className="text-xl font-semibold mb-4 text-primary">99.9% Uptime</h3>
              <p className="text-gray-600">Guaranteed server uptime for your peace of mind</p>
            </div>
            <div className="p-6 border border-gray-200 rounded-lg">
              <h3 className="text-xl font-semibold mb-4 text-primary">24/7 Support</h3>
              <p className="text-gray-600">Round-the-clock technical support for all your needs</p>
            </div>
            <div className="p-6 border border-gray-200 rounded-lg">
              <h3 className="text-xl font-semibold mb-4 text-primary">Secure Infrastructure</h3>
              <p className="text-gray-600">Advanced security measures to protect your data</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12 text-primary">Pricing Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 border border-gray-200 rounded-lg bg-white">
              <h3 className="text-2xl font-bold mb-4 text-primary">Basic</h3>
              <p className="text-3xl font-bold mb-6">$9.99<span className="text-gray-500 text-lg">/month</span></p>
              <ul className="space-y-4 mb-8">
                <li>1 Website</li>
                <li>10GB Storage</li>
                <li>100GB Bandwidth</li>
                <li>Basic Support</li>
              </ul>
              <button className="w-full bg-primary text-secondary py-2 rounded-lg hover:bg-gray-800 transition">
                Choose Plan
              </button>
            </div>
            <div className="p-8 border-2 border-primary rounded-lg bg-white">
              <h3 className="text-2xl font-bold mb-4 text-primary">Professional</h3>
              <p className="text-3xl font-bold mb-6">$19.99<span className="text-gray-500 text-lg">/month</span></p>
              <ul className="space-y-4 mb-8">
                <li>5 Websites</li>
                <li>50GB Storage</li>
                <li>500GB Bandwidth</li>
                <li>Priority Support</li>
              </ul>
              <button className="w-full bg-primary text-secondary py-2 rounded-lg hover:bg-gray-800 transition">
                Choose Plan
              </button>
            </div>
            <div className="p-8 border border-gray-200 rounded-lg bg-white">
              <h3 className="text-2xl font-bold mb-4 text-primary">Enterprise</h3>
              <p className="text-3xl font-bold mb-6">$49.99<span className="text-gray-500 text-lg">/month</span></p>
              <ul className="space-y-4 mb-8">
                <li>Unlimited Websites</li>
                <li>200GB Storage</li>
                <li>Unlimited Bandwidth</li>
                <li>24/7 Premium Support</li>
              </ul>
              <button className="w-full bg-primary text-secondary py-2 rounded-lg hover:bg-gray-800 transition">
                Choose Plan
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-secondary">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12 text-primary">Contact Us</h2>
          <div className="max-w-2xl mx-auto">
            <form className="space-y-6">
              <div>
                <label className="block text-gray-700 mb-2">Name</label>
                <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Email</label>
                <input type="email" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Message</label>
                <textarea className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary h-32"></textarea>
              </div>
              <button className="w-full bg-primary text-secondary py-3 rounded-lg hover:bg-gray-800 transition">
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-secondary py-8">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2024 NettyHost. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
} 