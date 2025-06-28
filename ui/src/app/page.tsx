'use client';

import { useState, useEffect } from 'react';
import { FamilyMember, Transfer, familyApi, CreateFamilyMemberData, UpdateFamilyMemberData, TransferRequest } from '@/lib/api';
import FamilyMemberForm from '@/components/FamilyMemberForm';
import TransferForm from '@/components/TransferForm';
import { log } from 'node:console';

type View = 'members' | 'transfers' | 'add-member' | 'edit-member' | 'new-transfer';

export default function Home() {
  const [currentView, setCurrentView] = useState<View>('members');
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (currentView === 'members') {
      loadMembers();
    } else if (currentView === 'transfers') {
      loadTransfers();
    }
  }, [currentView]);

  const loadMembers = async () => {
    try {
      setIsLoading(true);
      const response = await familyApi.getMembers({ search: searchTerm });
      console.log('response', response);
      
      setMembers(response.data);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTransfers = async () => {
    try {
      setIsLoading(true);
      const response = await familyApi.getTransfers();
      setTransfers(response.data);
    } catch (error) {
      console.error('Failed to load transfers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMember = async (data: CreateFamilyMemberData) => {
    await familyApi.createMember(data);
    setCurrentView('members');
    loadMembers();
  };

  const handleUpdateMember = async (data: UpdateFamilyMemberData) => {
    if (selectedMember) {
      await familyApi.updateMember(selectedMember.id, data);
      setCurrentView('members');
      setSelectedMember(null);
      loadMembers();
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (confirm('Are you sure you want to delete this member?')) {
      await familyApi.deleteMember(id);
      loadMembers();
    }
  };

  const handleCreateTransfer = async (data: TransferRequest) => {
    await familyApi.createTransfer(data);
    setCurrentView('transfers');
    loadTransfers();
  };

  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Family Money Transfer
              </h1>
              <div className="flex space-x-3">
                <button
                  onClick={() => setCurrentView('members')}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    currentView === 'members'
                      ? 'bg-blue-600 text-white'
                      : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                  }`}
                >
                  Members
                </button>
                <button
                  onClick={() => setCurrentView('transfers')}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    currentView === 'transfers'
                      ? 'bg-blue-600 text-white'
                      : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                  }`}
                >
                  Transfers
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {currentView === 'members' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center space-x-4">
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={loadMembers}
                      className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                    >
                      Search
                    </button>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setCurrentView('add-member')}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                    >
                      Add Member
                    </button>
                    <button
                      onClick={() => setCurrentView('new-transfer')}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
                    >
                      New Transfer
                    </button>
                  </div>
                </div>

                {isLoading ? (
                  <div className="text-center py-4">Loading...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Phone
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Balance
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredMembers.map((member) => (
                          <tr key={member.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {member.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {member.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {member.phone}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              ₦{member.balance.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                member.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {member.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => {
                                  setSelectedMember(member);
                                  setCurrentView('edit-member');
                                }}
                                className="text-blue-600 hover:text-blue-900 mr-3"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteMember(member.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {currentView === 'transfers' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-medium text-gray-900">Transfer History</h2>
                  <button
                    onClick={() => setCurrentView('new-transfer')}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
                  >
                    New Transfer
                  </button>
                </div>

                {isLoading ? (
                  <div className="text-center py-4">Loading...</div>
                ) : (
                  <div className="space-y-4">
                    {transfers.map((transfer) => (
                      <div key={transfer.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900">
                              Transfer #{transfer.reference}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                              {transfer.description}
                            </p>
                            <div className="mt-2">
                              <span className="text-sm font-medium text-gray-700">
                                Recipients:
                              </span>
                              {transfer.recipients.map((recipient, index) => (
                                <span key={index} className="text-sm text-gray-600 ml-2">
                                  {recipient.recipient.name} (₦{recipient.amount.toLocaleString()})
                                  {index < transfer.recipients.length - 1 && ', '}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-medium text-gray-900">
                              ₦{transfer.totalAmount.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(transfer.createdAt).toLocaleDateString()}
                            </div>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                              transfer.status === 'SUCCESS'
                                ? 'bg-green-100 text-green-800'
                                : (transfer.status === 'PENDING' || transfer.status === 'PROCESSING')
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {transfer.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {currentView === 'add-member' && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-6">Add Family Member</h2>
                <FamilyMemberForm
                  onSubmit={handleCreateMember}
                  onCancel={() => setCurrentView('members')}
                  isLoading={isLoading}
                />
              </div>
            )}

            {currentView === 'edit-member' && selectedMember && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-6">
                  Edit Family Member: {selectedMember.name}
                </h2>
                <FamilyMemberForm
                  initialData={selectedMember}
                  onSubmit={handleUpdateMember}
                  onCancel={() => {
                    setCurrentView('members');
                    setSelectedMember(null);
                  }}
                  isLoading={isLoading}
                />
              </div>
            )}

            {currentView === 'new-transfer' && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-6">Create New Transfer</h2>
                <TransferForm
                  onSubmit={handleCreateTransfer}
                  onCancel={() => setCurrentView('members')}
                  isLoading={isLoading}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}