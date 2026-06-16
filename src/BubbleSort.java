public class BubbleSort {

    public static void bubbleSort(int[] arr){
        boolean changed;
        do {
            changed = false;
            for(int i=0;i<arr.length-1;i++){
                if(arr[i]>arr[i+1]){
                    swap(arr,i,i+1);
                    changed = true;
                }
            }
            printArray(arr);
        } while(changed);
    }

    static void swap(int[] arr, int i, int j) {
        int tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }

    static void printArray(int[] arr) {
        for (int c : arr) System.out.print(c + " ");
        System.out.println();
    }

    public static void main(String[] args) {
        int[] coins = {50, 5, 200, 20, 10, 100};
        bubbleSort(coins);
    }
}
