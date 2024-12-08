import { MaterialService } from "@/lib/services/material-service";

// Add loading state for emissions
const [emissions, setEmissions] = useState<{
  totalGWP: number;
  totalUBP: number;
  totalPENRE: number;
} | null>(null);

useEffect(() => {
  const fetchEmissions = async () => {
    const totals = await MaterialService.calculateProjectTotals(project._id);
    setEmissions(totals);
  };
  fetchEmissions();
}, [project._id]);

// In the render section:
<div className="flex gap-2 mt-2">
  {project.emissions && (
    <Badge variant="secondary" className="gap-1">
      <Scale className="h-3 w-4" />
      {project.emissions.gwp.toLocaleString("de-CH", {
        maximumFractionDigits: 0,
      })}
      {" kg CO₂eq"}
    </Badge>
  )}
</div>;
