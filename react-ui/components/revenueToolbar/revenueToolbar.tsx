import { IRevenueCategory } from "../../interfaces/api.interface";
import styles from "./revenueToolbar.module.css";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { useState } from "react";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import { addRevenueCategory } from "../../services/revenueCategoryService";
import BrotherOptionsSchema from "../../interfaces/brotherOptions.schema";
import { addRevenue } from "../../services/revenueService";

interface Props {
  revenueCategories: Array<IRevenueCategory>;
  onRefresh: any;
}

export default function RevenueToolbarComponent(props: Props) {
  const [revenueCategoryName, setRevenueCategoryName] = useState("");
  const [revenueItemName, setRevenueItemName] = useState("");
  const [revenueCategory, setRevenueCategory] = useState("");
  const [revenueAmount, setRevenueAmount] = useState("");

  function handleAddRevenue() {
    addRevenue({
      date: new Date(),
      amount: Number(revenueAmount),
      category_id: props.revenueCategories.find(
        (category) => category.name == revenueCategory,
      )?.id,
      description: revenueItemName,
    });
    props.onRefresh();
  }

  function handleAddRevenueCategory() {
    addRevenueCategory({ name: revenueCategoryName });
    props.onRefresh();
  }

  return (
    <div className={styles.toolbar}>
      <div className={styles.panel}>
        <h3>Add Revenue</h3>
        <TextField
          required
          className={styles.toolbarFields}
          label="Revenue Item Description"
          value={revenueItemName}
          onChange={(event) => setRevenueItemName(event.target.value)}
        />
        <FormControl className={styles.toolbarFields}>
          <InputLabel>Revenue Category</InputLabel>
          <Select
            required
            label="Revenue Category"
            value={revenueCategory}
            onChange={(event) => setRevenueCategory(event.target.value)}
          >
            {props.revenueCategories.map((category) => (
              <MenuItem value={category.name}>{category.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          required
          className={styles.toolbarFields}
          label="Amount"
          type="number"
          value={revenueAmount}
          onChange={(event) => setRevenueAmount(event.target.value)}
        />
        <div className={styles.buttonWrapper}>
          <Button
            className={styles.button}
            variant="outlined"
            onClick={() => handleAddRevenue()}
          >
            <AddIcon></AddIcon>Add Revenue Item
          </Button>
        </div>
      </div>
      <div className={styles.panel}>
        <h3>Add Revenue Category</h3>
        <TextField
          required
          className={styles.toolbarFields}
          label="Revenue Category Name"
          value={revenueCategoryName}
          onChange={(event) => setRevenueCategoryName(event.target.value)}
        />
        <div className={styles.buttonWrapper}>
          <Button
            className={styles.button}
            variant="outlined"
            onClick={() => handleAddRevenueCategory()}
          >
            <AddIcon></AddIcon>Add Revenue Category
          </Button>
        </div>
      </div>
    </div>
  );
}
