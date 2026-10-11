import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Settings, Save, CheckCircle, AlertCircle } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { store, refreshSession } = useAuth();
  const [formData, setFormData] = useState({
    name: store?.name || '',
    address: store?.address || '',
    phone: store?.phone || '',
    email: store?.email || '',
    gstin: store?.gstin || '',
    invoicePrefix: store?.invoice_prefix || '',
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFeedback(null);
      await api.updateSettings(formData);
      await refreshSession();
      setFeedback({ type: 'success', text: 'Store settings updated successfully' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update store settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-neutral-50 overflow-y-auto">
      {/* Header */}
      <div className="p-4 bg-white border-b border-neutral-200 shrink-0">
        <h1 className="text-base font-semibold text-neutral-900 leading-none">
          Store & Invoice Settings
        </h1>
        <p className="text-xs text-neutral-500 mt-1">
          Configure business details, GSTIN tax credentials, and receipt headers.
        </p>
      </div>

      <div className="p-4 max-w-2xl w-full mx-auto space-y-4">
        {feedback && (
          <div
            className={`p-3 rounded text-xs flex justify-between items-center ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="font-bold">✕</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded border border-neutral-200 shadow-xs space-y-4 text-xs">
          <div className="space-y-3">
            <h3 className="font-bold text-neutral-900 text-sm border-b border-neutral-100 pb-2">
              Business Profile
            </h3>

            <div>
              <label className="font-medium text-neutral-700 block mb-1">Business / Store Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-medium text-neutral-700 block mb-1">Physical Store Address</label>
              <textarea
                rows={3}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full p-2 border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-neutral-700 block mb-1">Official Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-medium text-neutral-700 block mb-1">Official Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-neutral-100">
            <h3 className="font-bold text-neutral-900 text-sm border-b border-neutral-100 pb-2">
              Tax & Invoicing
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-neutral-700 block mb-1">GSTIN Number</label>
                <input
                  type="text"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                  placeholder="e.g. 29ABCDE1234F1Z5"
                  className="w-full px-2.5 py-1.5 font-mono border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-medium text-neutral-700 block mb-1">Bill Prefix Code</label>
                <input
                  type="text"
                  value={formData.invoicePrefix}
                  onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
                  placeholder="e.g. APX"
                  className="w-full px-2.5 py-1.5 font-mono uppercase border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-3 bg-neutral-50 rounded border border-neutral-200 space-y-1 text-[11px] text-neutral-600">
              <div className="flex justify-between">
                <span>Default Currency:</span>
                <span className="font-mono font-semibold text-neutral-800">INR (₹ Indian Rupee)</span>
              </div>
              <div className="flex justify-between">
                <span>Timezone:</span>
                <span className="font-mono font-semibold text-neutral-800">Asia/Kolkata (IST)</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-neutral-900 text-white rounded text-xs font-semibold hover:bg-neutral-800 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving Changes...' : 'Save Store Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
