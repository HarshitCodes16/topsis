"use client"

import React, { useState, useEffect } from 'react';
import { Upload, Mail, BarChart3, Info, AlertCircle, CheckCircle2, FileText, ChevronRight } from 'lucide-react';

export default function App() {
  const [file, setFile] = useState(null);
  const [weights, setWeights] = useState('');
  const [impacts, setImpacts] = useState('');
  const [email, setEmail] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');

  // Load XLSX library via CDN for environment compatibility
  useEffect(() => {
    if (!window.XLSX) {
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // --- TOPSIS Logic ---
  const parseFile = (file) => {
    return new Promise((resolve, reject) => {
      if (!window.XLSX) {
        reject(new Error("Excel library is still loading. Please try again in a second."));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = window.XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
          resolve(jsonData);
        } catch (error) {
          reject(new Error("Failed to parse file. Ensure it's a valid CSV or Excel."));
        }
      };
      reader.readAsBinaryString(file);
    });
  };

  const calculateTopsis = (data, wStr, iStr) => {
    const weightsArr = wStr.split(',').map(w => parseFloat(w.trim()));
    const impactsArr = iStr.split(',').map(i => i.trim());
    
    if (data.length === 0) throw new Error("The uploaded file is empty.");
    
    const headers = Object.keys(data[0]);
    const criteriaKeys = headers.slice(1);

    if (weightsArr.length !== criteriaKeys.length || impactsArr.length !== criteriaKeys.length) {
      throw new Error(`Criteria mismatch: Found ${criteriaKeys.length} columns but received ${weightsArr.length} weights and ${impactsArr.length} impacts.`);
    }

    const n = data.length;
    const m = criteriaKeys.length;
    const matrix = data.map(row => criteriaKeys.map(key => {
      const val = parseFloat(row[key]);
      if (isNaN(val)) throw new Error(`Non-numeric value detected in column: ${key}`);
      return val;
    }));

    // 1. Normalize
    const rss = Array(m).fill(0);
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < n; i++) rss[j] += Math.pow(matrix[i][j], 2);
      rss[j] = Math.sqrt(rss[j]);
      if (rss[j] === 0) rss[j] = 1; // Prevent division by zero
    }

    const weighted = matrix.map(row => 
      row.map((val, j) => (val / rss[j]) * weightsArr[j])
    );

    // 2. Ideals
    const best = [];
    const worst = [];
    for (let j = 0; j < m; j++) {
      const col = weighted.map(r => r[j]);
      if (impactsArr[j] === '+') {
        best[j] = Math.max(...col);
        worst[j] = Math.min(...col);
      } else {
        best[j] = Math.min(...col);
        worst[j] = Math.max(...col);
      }
    }

    // 3. Distances & Scores
    const scores = data.map((row, i) => {
      let dPlus = 0;
      let dMinus = 0;
      for (let j = 0; j < m; j++) {
        dPlus += Math.pow(weighted[i][j] - best[j], 2);
        dMinus += Math.pow(weighted[i][j] - worst[j], 2);
      }
      dPlus = Math.sqrt(dPlus);
      dMinus = Math.sqrt(dMinus);
      const score = (dPlus + dMinus === 0) ? 0 : dMinus / (dPlus + dMinus);
      return { ...row, score: score.toFixed(4) };
    });

    // 4. Rank
    return scores
      .sort((a, b) => b.score - a.score)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  };

  const handleProcess = async (e) => {
    e.preventDefault();
    setError(null);
    setIsProcessing(true);
    
    try {
      if (!file) throw new Error("Please upload a file first.");
      if (!weights) throw new Error("Please provide weights.");
      if (!impacts) throw new Error("Please provide impacts (+/-).");
      
      const data = await parseFile(file);
      const output = calculateTopsis(data, weights, impacts);
      console.log(output)

      // send email
      const response = await fetch('/api/send-email', {
        method: 'POST',
        body: JSON.stringify({ email, output }),
        headers: { 'Content-Type': 'application/json' }
      });

      const res = await response.json();
      console.log('Email API Response:', res);
      setResults(output);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation / Header */}
      <nav className="max-w-6xl mx-auto px-6 py-8 flex justify-between items-center">
        <div className="flex items-center gap-2 group cursor-default">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white transition-transform group-hover:rotate-12">
            <BarChart3 size={20} />
          </div>
          <span className="font-bold text-xl tracking-tight">Topsis<span className="text-blue-600">Core</span></span>
        </div>
        
      </nav>

      <main className="max-w-6xl mx-auto px-6 pb-24 grid lg:grid-cols-5 gap-12 items-start">
        {/* Left Side: Inputs */}
        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Precision Ranking.</h1>
            <p className="text-lg text-slate-500 leading-relaxed">
              Upload your dataset and apply the TOPSIS algorithm to determine the ideal solution with mathematical rigor.
            </p>
          </div>

          <form onSubmit={handleProcess} className="space-y-6">
            {/* File Upload Area */}
            <div className="group relative">
              <label className={`
                flex flex-col items-center justify-center w-full h-44 
                border-2 border-dashed rounded-3xl cursor-pointer
                transition-all duration-300
                ${file ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-slate-50'}
              `}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                  {file ? (
                    <>
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                        <CheckCircle2 size={24} />
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{fileName}</p>
                      <p className="text-xs text-slate-500 mt-1">Ready for analysis</p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                        <Upload size={24} />
                      </div>
                      <p className="text-sm text-slate-600">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Excel or CSV files only</p>
                    </>
                  )}
                </div>
                <input type="file" className="hidden" onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                    setFileName(e.target.files[0].name);
                  }
                }} accept=".csv,.xlsx,.xls" />
              </label>
            </div>

            {/* Inputs Container */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5">
              <div className="space-y-4">
                <div className="relative">
                  <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-1.5 block ml-1">Weights</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-300"
                    placeholder="e.g. 1, 1, 1, 1"
                    value={weights}
                    onChange={(e) => setWeights(e.target.value)}
                  />
                </div>

                <div className="relative">
                  <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-1.5 block ml-1">Impacts</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-300"
                    placeholder="e.g. +, +, -, +"
                    value={impacts}
                    onChange={(e) => setImpacts(e.target.value)}
                  />
                </div>

                <div className="relative">
                  <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-1.5 block ml-1">Delivery Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 pl-11 text-sm focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-300"
                      placeholder="results@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 text-red-600 rounded-2xl animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed font-medium">{error}</p>
                </div>
              )}

              <button
                disabled={!file || isProcessing}
                className="w-full bg-slate-900 text-white rounded-2xl py-4 font-semibold hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-200 flex items-center justify-center gap-2 group"
              >
                {isProcessing ? 'Analyzing Matrix...' : 'Generate Ranking'}
                {!isProcessing && <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />}
              </button>
            </div>
          </form>

          {/* Quick Guide */}
          <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100/50">
            <div className="flex items-center gap-2 mb-3 text-blue-800">
              <Info size={18} />
              <h3 className="font-bold text-sm">Quick Format Guide</h3>
            </div>
            <ul className="text-xs text-blue-700/80 space-y-2 leading-relaxed">
              <li className="flex gap-2"><span>•</span> 1st column: Alternative names (Items)</li>
              <li className="flex gap-2"><span>•</span> Other columns: Criteria values (Numbers)</li>
              <li className="flex gap-2"><span>•</span> Impacts: '+' for beneficial, '-' for cost-based</li>
            </ul>
          </div>
        </div>

        {/* Right Side: Results Display */}
        <div className="lg:col-span-3 min-h-[500px]">
          {!results ? (
            <div className="h-full w-full border border-slate-100 rounded-[2rem] bg-white flex flex-col items-center justify-center text-center p-12 space-y-4">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                <FileText size={40} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Analysis Preview</h3>
                <p className="text-sm text-slate-400 max-w-xs mt-1">Upload your file and run the algorithm to see the ranked candidates here.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-700">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Ranking Output</h2>
                  <p className="text-sm text-slate-500">Based on {results.length} alternatives</p>
                </div>
                <button 
                  onClick={() => window.print()}
                  className="text-xs font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-lg"
                >
                  Download Report
                </button>
              </div>

              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Rank</th>
                        <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Alternative</th>
                        <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Score</th>
                        <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {results.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-5">
                            <span className={`
                              inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold
                              ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}
                            `}>
                              {item.rank}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <p className="text-sm font-bold text-slate-800">{Object.values(item)[0]}</p>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-mono font-medium text-slate-500">{item.score}</span>
                              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                                  style={{ width: `${item.score * 100}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className={`
                              text-[10px] font-bold uppercase tracking-tighter px-2.5 py-1 rounded-md
                              ${idx === 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}
                            `}>
                              {idx === 0 ? 'Best Choice' : 'Candidate'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-400 font-medium tracking-wide">
          © 2026 TOPSISCORE DECISION ENGINE • PRIVACY • SECURITY • TERMS
        </p>
      </footer>
    </div>
  );
}