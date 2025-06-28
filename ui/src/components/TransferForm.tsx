'use client';

import { useState, useEffect } from 'react';
import { FamilyMember, TransferRequest, familyApi } from '@/lib/api';

interface TransferFormProps {
  onSubmit: (data: TransferRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export default function TransferForm({ onSubmit, onCancel, isLoading }: TransferFormProps) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [recipients, setRecipients] = useState<Array<{ id: string; amount: number }>>([
    { id: '', amount: 0 },
  ]);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const response = await familyApi.getMembers();
      setMembers(response.data);
    } catch (error) {
      console.error('Failed to load members:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validRecipients = recipients.filter(r => r.id && r.amount > 0);
    
    if (validRecipients.length === 0) {
      setErrors({ recipients: 'At least one recipient with amount is required' });
      return;
    }

    try {
      await onSubmit({
        recipients: validRecipients,
        reference: reference || undefined,
        description: description || undefined,
      });
    } catch (error) {
      if (error instanceof Error) {
        setErrors({ general: error.message });
      }
    }
  };

  const addRecipient = () => {
    setRecipients([...recipients, { id: '', amount: 0 }]);
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const updateRecipient = (index: number, field: 'id' | 'amount', value: string | number) => {
    const updated = [...recipients];
    updated[index] = { ...updated[index], [field]: value };
    setRecipients(updated);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors.general && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded">
          {errors.general}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Recipients *
        </label>
        {errors.recipients && (
          <div className="text-red-600 text-sm mb-2">{errors.recipients}</div>
        )}
        
        {recipients.map((recipient, index) => (
          <div key={index} className="flex space-x-3 mb-3">
            <select
              value={recipient.id}
              onChange={(e) => updateRecipient(index, 'id', e.target.value)}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Select recipient...</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.email})
                </option>
              ))}
            </select>
            
            <input
              type="number"
              placeholder="Amount"
              min="1"
              step="0.01"
              value={recipient.amount || ''}
              onChange={(e) => updateRecipient(index, 'amount', parseFloat(e.target.value) || 0)}
              className="w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            
            {recipients.length > 1 && (
              <button
                type="button"
                onClick={() => removeRecipient(index)}
                className="px-3 py-2 text-red-600 hover:text-red-800"
              >
                ×
              </button>
            )}
          </div>
        ))}
        
        <button
          type="button"
          onClick={addRecipient}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          + Add recipient
        </button>
      </div>

      <div>
        <label htmlFor="reference" className="block text-sm font-medium text-gray-700">
          Reference
        </label>
        <input
          type="text"
          id="reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <input
          type="text"
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? 'Processing...' : 'Send Transfer'}
        </button>
      </div>
    </form>
  );
}