package com.example.calculator;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity implements View.OnClickListener {
    private TextView display;
    private int currentNumber;
    private int previousNumber;
    private int pendingOp;   // 0=none, 1=+, 2=-, 3=*, 4=/
    private boolean freshInput;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        currentNumber = 0;
        previousNumber = 0;
        pendingOp = 0;
        freshInput = true;

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(1); // VERTICAL

        // Display
        display = new TextView(this);
        display.setText("0");
        display.setTextSize(32.0f);
        display.setTextColor(0xFF000000);
        root.addView(display);

        // Button rows: [7 8 9 /] [4 5 6 *] [1 2 3 -] [C 0 = +]
        String[] labels = {
            "7", "8", "9", "/",
            "4", "5", "6", "*",
            "1", "2", "3", "-",
            "C", "0", "=", "+"
        };
        int[] ids = {
            7, 8, 9, 13,
            4, 5, 6, 12,
            1, 2, 3, 11,
            15, 0, 14, 10
        };

        for (int row = 0; row < 4; row++) {
            LinearLayout rowLayout = new LinearLayout(this);
            rowLayout.setOrientation(0); // HORIZONTAL

            for (int col = 0; col < 4; col++) {
                int idx = row * 4 + col;
                Button btn = new Button(this);
                btn.setText(labels[idx]);
                btn.setId(ids[idx]);
                btn.setOnClickListener(this);
                rowLayout.addView(btn);
            }

            root.addView(rowLayout);
        }

        setContentView(root);
    }

    @Override
    public void onClick(View v) {
        int id = v.getId();

        if (id >= 0 && id <= 9) {
            // Digit
            if (freshInput) {
                currentNumber = id;
                freshInput = false;
            } else {
                currentNumber = currentNumber * 10 + id;
            }
            updateDisplay();
        } else if (id >= 10 && id <= 13) {
            // Operator: 10=+, 11=-, 12=*, 13=/
            computePending();
            previousNumber = currentNumber;
            pendingOp = id - 9; // 1=+, 2=-, 3=*, 4=/
            freshInput = true;
        } else if (id == 14) {
            // Equals
            computePending();
            pendingOp = 0;
            freshInput = true;
        } else if (id == 15) {
            // Clear
            currentNumber = 0;
            previousNumber = 0;
            pendingOp = 0;
            freshInput = true;
            updateDisplay();
        }
    }

    private void computePending() {
        if (pendingOp == 1) {
            currentNumber = previousNumber + currentNumber;
        } else if (pendingOp == 2) {
            currentNumber = previousNumber - currentNumber;
        } else if (pendingOp == 3) {
            currentNumber = previousNumber * currentNumber;
        } else if (pendingOp == 4) {
            if (currentNumber != 0) {
                currentNumber = previousNumber / currentNumber;
            }
        }
        updateDisplay();
    }

    private void updateDisplay() {
        StringBuilder sb = new StringBuilder();
        sb.append(currentNumber);
        display.setText(sb.toString());
    }
}
