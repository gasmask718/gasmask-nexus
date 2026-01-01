import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, Plus, Loader2, Tag, Edit, Users, MoreVertical, Trash2 } from 'lucide-react';
import { useStaffCategories, useCreateStaffCategory, useDeleteStaffCategory, StaffCategory } from '@/hooks/useUnforgettableStaff';
import { SimulationBadge } from '@/contexts/SimulationModeContext';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { DeleteConfirmModal } from '@/components/crud/DeleteConfirmModal';
import { EditStaffCategoryModal } from '@/components/staff/EditStaffCategoryModal';

export default function UnforgettableStaffCategories() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const { data: categories, isLoading } = useStaffCategories();
  const createCategory = useCreateStaffCategory();
  const deleteCategory = useDeleteStaffCategory();
  
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  
  // Edit state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<StaffCategory | null>(null);
  
  // Delete state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<StaffCategory | null>(null);

  // TODO: Replace with actual role check from auth context
  // For now, assuming admin access - in production this should check user role
  const isAdmin = true; // This should come from useUserRole() or similar

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      await createCategory.mutateAsync({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined,
      });
      
      setNewCategoryName('');
      setNewCategoryDescription('');
      setAddCategoryOpen(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleEditClick = (category: StaffCategory) => {
    setCategoryToEdit(category);
    setEditModalOpen(true);
  };

  const handleDeleteClick = (category: StaffCategory) => {
    setCategoryToDelete(category);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    await deleteCategory.mutateAsync(categoryToDelete.id);
    setCategoryToDelete(null);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/os/unforgettable/staff')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Tag className="h-8 w-8 text-primary" />
              Staff Categories
              {simulationMode && <SimulationBadge />}
            </h1>
            <p className="text-muted-foreground">Manage staff role categories for Unforgettable Times</p>
          </div>
        </div>
        <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-pink-600 to-purple-500 hover:from-pink-700 hover:to-purple-600">
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Staff Category</DialogTitle>
              <DialogDescription>
                Create a new staff role category
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="catName">Category Name *</Label>
                <Input
                  id="catName"
                  placeholder="e.g., Face Painter"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catDesc">Description</Label>
                <Input
                  id="catDesc"
                  placeholder="Brief description of this role"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddCategoryOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={handleAddCategory}
                disabled={createCategory.isPending || !newCategoryName.trim()}
              >
                {createCategory.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  'Create Category'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories?.map((category) => (
            <Card key={category.id} className="hover:border-pink-500/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-pink-500/10">
                      <Users className="h-5 w-5 text-pink-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={category.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-500/10 text-gray-600'}>
                      {category.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {/* Admin-only actions menu */}
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditClick(category)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Category
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteClick(category)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Category
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {category.description || 'No description provided'}
                </p>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleEditClick(category)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {categories?.length === 0 && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No categories yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first staff category to get started
            </p>
            <Button onClick={() => setAddCategoryOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Category Modal */}
      <EditStaffCategoryModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        category={categoryToEdit}
        onDelete={handleDeleteClick}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete Staff Category"
        description={
          categoryToDelete
            ? `This will remove "${categoryToDelete.name}" from active use. Staff assigned to this category will be unassigned. History and KPI data will be preserved but archived.`
            : undefined
        }
        itemName={categoryToDelete?.name}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
