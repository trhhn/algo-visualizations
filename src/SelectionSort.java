public class SelectionSort {

    public static void selectionSort(int[] arr){
        for(int i=0;i<arr.length-1;i++){
            int min = i;
            for(int j=i+1;j<arr.length;j++){
                if(arr[j]<arr[min]){
                    min = j;
                }
            }
            swap(arr,i,min);
            printArray(arr);
        }
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
        selectionSort(coins);
    }
}
