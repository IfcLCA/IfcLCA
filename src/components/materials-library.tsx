"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Search, Plus, Edit, Trash2 } from "lucide-react";

type Material = {
  id: string;
  name: string;
  category: string;
  density: number;
  embodiedCarbon: number;
  cost: number;
};

const initialMaterials: Material[] = [
  {
    id: "1",
    name: "Concrete",
    category: "Structural",
    density: 2400,
    embodiedCarbon: 0.1,
    cost: 100,
  },
  {
    id: "2",
    name: "Steel",
    category: "Structural",
    density: 7850,
    embodiedCarbon: 1.46,
    cost: 500,
  },
  {
    id: "3",
    name: "Glass",
    category: "Finishes",
    density: 2500,
    embodiedCarbon: 0.85,
    cost: 300,
  },
  {
    id: "4",
    name: "Wood",
    category: "Structural",
    density: 700,
    embodiedCarbon: 0.31,
    cost: 200,
  },
  {
    id: "5",
    name: "Insulation",
    category: "Thermal",
    density: 30,
    embodiedCarbon: 1.86,
    cost: 50,
  },
];

export function MaterialsLibrary() {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newMaterial, setNewMaterial] = useState<Partial<Material>>({});
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  const itemsPerPage = 5;
  const categories = ["All", ...new Set(materials.map((m) => m.category))];

  const filteredMaterials = materials.filter(
    (material) =>
      material.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (categoryFilter === "All" || material.category === categoryFilter)
  );

  const paginatedMaterials = filteredMaterials.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleAddMaterial = () => {
    if (
      newMaterial.name &&
      newMaterial.category &&
      newMaterial.density &&
      newMaterial.embodiedCarbon &&
      newMaterial.cost
    ) {
      setMaterials([
        ...materials,
        { ...newMaterial, id: Date.now().toString() } as Material,
      ]);
      setNewMaterial({});
      setIsAddDialogOpen(false);
    }
  };

  const handleEditMaterial = () => {
    if (editingMaterial) {
      setMaterials(
        materials.map((m) =>
          m.id === editingMaterial.id ? editingMaterial : m
        )
      );
      setEditingMaterial(null);
    }
  };

  const handleDeleteMaterial = (id: string) => {
    setMaterials(materials.filter((m) => m.id !== id));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Materials Library</CardTitle>
        <CardDescription>
          Manage and view all materials used in your projects.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between mb-4">
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search materials..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Material
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Material</DialogTitle>
                <DialogDescription>
                  Enter the details of the new material.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={newMaterial.name || ""}
                    onChange={(e) =>
                      setNewMaterial({ ...newMaterial, name: e.target.value })
                    }
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="category" className="text-right">
                    Category
                  </Label>
                  <Input
                    id="category"
                    value={newMaterial.category || ""}
                    onChange={(e) =>
                      setNewMaterial({
                        ...newMaterial,
                        category: e.target.value,
                      })
                    }
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="density" className="text-right">
                    Density (kg/m³)
                  </Label>
                  <Input
                    id="density"
                    type="number"
                    value={newMaterial.density || ""}
                    onChange={(e) =>
                      setNewMaterial({
                        ...newMaterial,
                        density: parseFloat(e.target.value),
                      })
                    }
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="embodiedCarbon" className="text-right">
                    Embodied Carbon (kgCO2e/kg)
                  </Label>
                  <Input
                    id="embodiedCarbon"
                    type="number"
                    value={newMaterial.embodiedCarbon || ""}
                    onChange={(e) =>
                      setNewMaterial({
                        ...newMaterial,
                        embodiedCarbon: parseFloat(e.target.value),
                      })
                    }
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="cost" className="text-right">
                    Cost ($/m³)
                  </Label>
                  <Input
                    id="cost"
                    type="number"
                    value={newMaterial.cost || ""}
                    onChange={(e) =>
                      setNewMaterial({
                        ...newMaterial,
                        cost: parseFloat(e.target.value),
                      })
                    }
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddMaterial}>Add Material</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Density (kg/m³)</TableHead>
              <TableHead>Embodied Carbon (kgCO2e/kg)</TableHead>
              <TableHead>Cost ($/m³)</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedMaterials.map((material) => (
              <TableRow key={material.id}>
                <TableCell>{material.name}</TableCell>
                <TableCell>{material.category}</TableCell>
                <TableCell>{material.density}</TableCell>
                <TableCell>{material.embodiedCarbon}</TableCell>
                <TableCell>{material.cost}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setEditingMaterial(material)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Material</DialogTitle>
                          <DialogDescription>
                            Edit the details of the material.
                          </DialogDescription>
                        </DialogHeader>
                        {editingMaterial && (
                          <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="edit-name" className="text-right">
                                Name
                              </Label>
                              <Input
                                id="edit-name"
                                value={editingMaterial.name}
                                onChange={(e) =>
                                  setEditingMaterial({
                                    ...editingMaterial,
                                    name: e.target.value,
                                  })
                                }
                                className="col-span-3"
                              />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label
                                htmlFor="edit-category"
                                className="text-right"
                              >
                                Category
                              </Label>
                              <Input
                                id="edit-category"
                                value={editingMaterial.category}
                                onChange={(e) =>
                                  setEditingMaterial({
                                    ...editingMaterial,
                                    category: e.target.value,
                                  })
                                }
                                className="col-span-3"
                              />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label
                                htmlFor="edit-density"
                                className="text-right"
                              >
                                Density (kg/m³)
                              </Label>
                              <Input
                                id="edit-density"
                                type="number"
                                value={editingMaterial.density}
                                onChange={(e) =>
                                  setEditingMaterial({
                                    ...editingMaterial,
                                    density: parseFloat(e.target.value),
                                  })
                                }
                                className="col-span-3"
                              />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label
                                htmlFor="edit-embodiedCarbon"
                                className="text-right"
                              >
                                Embodied Carbon (kgCO2e/kg)
                              </Label>
                              <Input
                                id="edit-embodiedCarbon"
                                type="number"
                                value={editingMaterial.embodiedCarbon}
                                onChange={(e) =>
                                  setEditingMaterial({
                                    ...editingMaterial,
                                    embodiedCarbon: parseFloat(e.target.value),
                                  })
                                }
                                className="col-span-3"
                              />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="edit-cost" className="text-right">
                                Cost ($/m³)
                              </Label>
                              <Input
                                id="edit-cost"
                                type="number"
                                value={editingMaterial.cost}
                                onChange={(e) =>
                                  setEditingMaterial({
                                    ...editingMaterial,
                                    cost: parseFloat(e.target.value),
                                  })
                                }
                                className="col-span-3"
                              />
                            </div>
                          </div>
                        )}
                        <DialogFooter>
                          <Button onClick={handleEditMaterial}>
                            Save Changes
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteMaterial(material.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-end space-x-2 py-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="text-sm">
              Page {currentPage} of{" "}
              {Math.ceil(filteredMaterials.length / itemsPerPage)}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={
                currentPage >=
                Math.ceil(filteredMaterials.length / itemsPerPage)
              }
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">
          Showing {paginatedMaterials.length} of {filteredMaterials.length}{" "}
          materials
        </p>
      </CardFooter>
    </Card>
  );
}
