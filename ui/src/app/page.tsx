'use client';

import { useState, useEffect, useCallback } from 'react';
import { FamilyMember, Transfer, blackTaxApi, CreateFamilyMemberData, UpdateFamilyMemberData, TransferRequest } from '@/lib/api';
import FamilyMemberForm from '@/components/FamilyMemberForm';
import TransferForm from '@/components/TransferForm';
import MembersView from '@/components/MembersView';
import TransfersView from '@/components/TransfersView';
import LoadingSpinner from '@/components/LoadingSpinner';

type View = 'members' | 'transfers' | 'add-member' | 'edit-member' | 'new-transfer';

export default function Home() {
  const [currentView, setCurrentView] = useState<View>('members');
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await blackTaxApi.getMembers({ search: searchTerm });
      setMembers(response.data);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm])

  useEffect(() => {
    if (currentView === 'members') {
      loadMembers();
    } else if (currentView === 'transfers') {
      loadTransfers();
    }
  }, [currentView, loadMembers]);

  const loadTransfers = async () => {
    try {
      setIsLoading(true);
      const response = await blackTaxApi.getTransfers();
      setTransfers(response.data);
    } catch (error) {
      console.error('Failed to load transfers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMember = async (data: CreateFamilyMemberData) => {
    await blackTaxApi.createMember(data);
    setCurrentView('members');
    loadMembers();
  };

  const handleUpdateMember = async (data: UpdateFamilyMemberData) => {
    if (selectedMember) {
      await blackTaxApi.updateMember(selectedMember.id, data);
      setCurrentView('members');
      setSelectedMember(null);
      loadMembers();
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (confirm('Are you sure you want to delete this member?')) {
      await blackTaxApi.deleteMember(id);
      loadMembers();
    }
  };

  const handleCreateTransfer = async (data: TransferRequest) => {
    await blackTaxApi.createTransfer(data);
    setCurrentView('transfers');
    loadTransfers();
  };

  const handleEditMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setCurrentView('edit-member');
  };

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSpinner />;
    }

    switch (currentView) {
      case 'members':
        return (
          <MembersView
            members={members}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onSearch={loadMembers}
            onAddMember={() => setCurrentView('add-member')}
            onNewTransfer={() => setCurrentView('new-transfer')}
            onEditMember={handleEditMember}
            onDeleteMember={handleDeleteMember}
          />
        );

      case 'transfers':
        return (
          <TransfersView
            transfers={transfers}
            onNewTransfer={() => setCurrentView('new-transfer')}
          />
        );

      case 'add-member':
        return (
          <div>
            <FamilyMemberForm
              onSubmit={handleCreateMember}
              onCancel={() => setCurrentView('members')}
              isLoading={isLoading}
            />
          </div>
        );

      case 'edit-member':
        return selectedMember ? (
          <div>
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
        ) : null;

      case 'new-transfer':
        return (
          <div>
            <TransferForm
              onSubmit={handleCreateTransfer}
              onCancel={() => setCurrentView('members')}
              isLoading={isLoading}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Blacktax
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
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}